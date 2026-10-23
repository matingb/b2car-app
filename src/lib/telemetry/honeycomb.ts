import { trace, context, propagation, SpanStatusCode, type Span, type Context } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { SpanProcessor, ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type {
  TelemetryProvider,
  TelemetryIdentity,
  TelemetryUser,
  TelemetryContext,
  TelemetryAttributes,
  TelemetryLogLevel,
} from "./types";
import { buildTelemetryAttributes, identityFromClaims } from "./identity";
import { decodeJwtPayload } from "@/lib/jwt";

export { logs, SeverityNumber };

let clientInitialized = false;
let serverInitialized = false;

export const ALLOWED_BAGGAGE_KEYS = new Set([
  "user.id",
  "user.email",
  "user.role",
  "user.name",
  "tenant.id",
  "tenant.name",
  "tenant.plan",
]);

let clientIdentityAttributes: TelemetryAttributes | null = null;
type AsyncLocalStorageType = import("node:async_hooks").AsyncLocalStorage<TelemetryAttributes>;
let serverIdentityStorage: AsyncLocalStorageType | null = null;

if (typeof window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncHooks = require("node:async_hooks") as typeof import("node:async_hooks");
    serverIdentityStorage = new asyncHooks.AsyncLocalStorage<TelemetryAttributes>();
  } catch {}
}

export function getActiveIdentityAttributes(): TelemetryAttributes | null {
  if (typeof window !== "undefined") {
    return clientIdentityAttributes;
  }
  return serverIdentityStorage?.getStore() ?? clientIdentityAttributes;
}

function createIdentityBaggage(attrs: TelemetryAttributes, parentContext = context.active()) {
  let baggage = propagation.getBaggage(parentContext) || propagation.createBaggage();
  for (const [k, v] of Object.entries(attrs)) {
    if (ALLOWED_BAGGAGE_KEYS.has(k)) {
      baggage = baggage.setEntry(k, { value: String(v) });
    }
  }
  return baggage;
}

export function setActiveIdentity(attrs: TelemetryAttributes | null): void {
  clientIdentityAttributes = attrs;
  if (serverIdentityStorage && attrs) {
    serverIdentityStorage.enterWith(attrs);
  }
  if (attrs) {
    try {
      propagation.setBaggage(context.active(), createIdentityBaggage(attrs));
    } catch {}
  }
}

export function clearActiveIdentity(): void {
  clientIdentityAttributes = null;
  if (serverIdentityStorage) {
    serverIdentityStorage.enterWith({});
  }
  try {
    propagation.setBaggage(context.active(), propagation.createBaggage());
  } catch {}
}

export function enrichSpan(span?: Span | null, attrs?: TelemetryAttributes | null): void {
  if (!span || !attrs) return;
  try {
    for (const [key, value] of Object.entries(attrs)) {
      span.setAttribute(key, value);
    }
  } catch {}
}

export class HoneycombNativeSpanProcessor implements SpanProcessor {
  onStart(span: Span, parentContext: Context): void {
    try {
      const baggage = propagation.getBaggage(parentContext);
      if (baggage) {
        for (const [key, entry] of baggage.getAllEntries()) {
          if (ALLOWED_BAGGAGE_KEYS.has(key)) {
            span.setAttribute(key, entry.value);
          }
        }
      }
    } catch {}

    enrichSpan(span, getActiveIdentityAttributes());
  }

  onEnd(span: ReadableSpan): void {
    const activeAttrs = getActiveIdentityAttributes();
    if (!activeAttrs) return;

    try {
      const attributes = (span as unknown as { attributes?: Record<string, unknown> }).attributes;
      if (attributes) {
        for (const [key, value] of Object.entries(activeAttrs)) {
          if (attributes[key] === undefined) {
            attributes[key] = value;
          }
        }
      }
    } catch {}
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export async function initHoneycombClient(): Promise<void> {
  if (typeof window === "undefined" || clientInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
  if (!apiKey) return;

  try {
    const { HoneycombWebSDK } = await import("@honeycombio/opentelemetry-web");
    const { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } = await import("@opentelemetry/core");

    const sdk = new HoneycombWebSDK({
      apiKey,
      serviceName: process.env.NEXT_PUBLIC_TELEMETRY_FRONTEND_SERVICE_NAME!,
      textMapPropagator: new CompositePropagator({
        propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
      }),
      spanProcessors: [new HoneycombNativeSpanProcessor()],
    });

    sdk.start();
    clientInitialized = true;
  } catch (error) {
    console.error("[Honeycomb] Error al inicializar Web SDK en el cliente:", error);
  }
}

export function extractClaimsFromCookieHeader(cookieHeader?: string): Record<string, unknown> | null {
  if (!cookieHeader) return null;

  try {
    const tokenChunks = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("sb-") && part.includes("-auth-token"))
      .sort()
      .map((part) => part.slice(part.indexOf("=") + 1));

    if (tokenChunks.length === 0) return null;

    let raw = decodeURIComponent(tokenChunks.join(""));
    if (raw.startsWith("base64-")) {
      raw = Buffer.from(raw.slice(7), "base64url").toString("utf8");
    }

    let token: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null);
    } catch {
      token = raw.includes(".") ? raw : null;
    }

    return token ? decodeJwtPayload(token) : null;
  } catch {
    return null;
  }
}

export async function initHoneycombServer(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || serverInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
  if (!apiKey && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { OTLPLogExporter } = await import("@opentelemetry/exporter-logs-otlp-http");
    const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");
    const { BatchLogRecordProcessor } = await import("@opentelemetry/sdk-logs");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

    const endpoint = "https://api.honeycomb.io/v1/traces";
    const logsEndpoint = "https://api.honeycomb.io/v1/logs";
    const serviceName = process.env.TELEMETRY_BACKEND_SERVICE_NAME || "b2car-backend";
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    const environment = process.env.NEXT_PUBLIC_DATADOG_ENV || process.env.NODE_ENV || "production";

    const headers = apiKey
      ? {
          "x-honeycomb-team": apiKey,
          ...(process.env.HONEYCOMB_DATASET ? { "x-honeycomb-dataset": process.env.HONEYCOMB_DATASET } : {}),
        }
      : undefined;

    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
      headers,
    });

    const logExporter = new OTLPLogExporter({
      url: logsEndpoint,
      headers,
    });

    const sdk = new NodeSDK({
      serviceName,
      resource: resourceFromAttributes({
        [ATTR_SERVICE_VERSION]: appVersion,
        "deployment.environment": environment,
      }),
      spanProcessors: [
        new HoneycombNativeSpanProcessor(),
        new BatchSpanProcessor(traceExporter),
      ],
      logRecordProcessors: [new BatchLogRecordProcessor({ exporter: logExporter })],
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false,
          },
          "@opentelemetry/instrumentation-http": {
            requestHook: (span, request) => {
              try {
                const req = request as import("http").IncomingMessage;
                if (req.url?.startsWith("/api/")) {
                  span.setAttribute("api.route", req.url.split("?")[0]);
                }

                const claims = extractClaimsFromCookieHeader(req.headers?.cookie);
                if (claims) {
                  const identity = identityFromClaims(claims);
                  if (identity) {
                    setActiveIdentity(buildTelemetryAttributes(identity));
                  }
                }

                enrichSpan(span, getActiveIdentityAttributes());
              } catch {}
            },
            responseHook: (span) => {
              enrichSpan(span, getActiveIdentityAttributes());
            },
          },
        }),
      ],
    });

    sdk.start();
    serverInitialized = true;
    console.log(`[Honeycomb] Backend OpenTelemetry inicializado (service: ${serviceName}, env: ${environment})`);

    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch {}
    };
    const proc = (globalThis as unknown as { process?: NodeJS.Process }).process;
    if (proc && typeof proc.once === "function") {
      proc.once("SIGTERM", shutdown);
      proc.once("SIGINT", shutdown);
    }
  } catch (error) {
    console.error("[Honeycomb/OpenTelemetry] Error al inicializar NodeSDK:", error);
  }
}

function toOtelAttributes(
  context?: TelemetryContext,
): Record<string, string | number | boolean> {
  if (!context) return {};
  const formatted: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      formatted[key] = value;
    } else {
      formatted[key] = JSON.stringify(value);
    }
  }
  return formatted;
}

export const honeycombProvider: TelemetryProvider = {
  name: "honeycomb",

  initClient: initHoneycombClient,
  initServer: initHoneycombServer,

  identify(identity: TelemetryIdentity, attributes?: TelemetryAttributes): void {
    const attrs = attributes ?? buildTelemetryAttributes(identity);
    setActiveIdentity(attrs);
    enrichSpan(trace.getActiveSpan() as Span, attrs);
  },

  setUser(user: TelemetryUser): void {
    const tenantId = user.tenant_id || user.id;
    const tenantName = user.tenant_name || user.name || undefined;
    const plan = user.plan_sub || undefined;

    this.identify?.({
      user: { id: user.id, email: user.email || undefined },
      account: tenantId ? { id: tenantId, name: tenantName, plan } : undefined,
    });
  },

  clearUser(): void {
    clearActiveIdentity();
  },

  async withIdentity<T>(identity: TelemetryIdentity, fn: () => Promise<T> | T): Promise<T> {
    const attrs = buildTelemetryAttributes(identity);
    setActiveIdentity(attrs);

    let newContext = context.active();
    try {
      newContext = propagation.setBaggage(context.active(), createIdentityBaggage(attrs));
    } catch {}

    const runInContext = () => context.with(newContext, fn);

    if (serverIdentityStorage) {
      return serverIdentityStorage.run(attrs, runInContext);
    }
    return runInContext();
  },

  trackAction(name: string, contextData?: TelemetryContext): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        const activeIdentityAttrs = getActiveIdentityAttributes();
        span.addEvent(name, toOtelAttributes({ ...activeIdentityAttrs, ...contextData }));
      }
    } catch {}
  },

  recordException(error: Error, contextData?: TelemetryContext): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        enrichSpan(span as Span, getActiveIdentityAttributes());
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        if (contextData) {
          for (const [k, v] of Object.entries(contextData)) {
            if (v !== undefined && v !== null) {
              span.setAttribute(
                `error.context.${k}`,
                typeof v === "object" ? JSON.stringify(v) : String(v),
              );
            }
          }
        }
      }
    } catch {}
  },

  log(level: TelemetryLogLevel, message: string, contextData?: TelemetryContext): void {
    try {
      const activeIdentityAttrs = getActiveIdentityAttributes();
      const eventName = message || `log_${level}`;
      const attributes = toOtelAttributes({
        severity: level,
        ...activeIdentityAttrs,
        ...contextData,
      });

      const span = trace.getActiveSpan();
      if (span) {
        span.setAttributes(attributes);
        span.addEvent(eventName, attributes);
      }

      const severityMap: Record<TelemetryLogLevel, { number: SeverityNumber; text: string }> = {
        debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
        info: { number: SeverityNumber.INFO, text: "INFO" },
        warn: { number: SeverityNumber.WARN, text: "WARN" },
        error: { number: SeverityNumber.ERROR, text: "ERROR" },
      };

      const sev = severityMap[level] ?? { number: SeverityNumber.INFO, text: "INFO" };
      const otelLogger = logs.getLogger("b2car-app");
      otelLogger.emit({
        severityNumber: sev.number,
        severityText: sev.text,
        body: eventName,
        attributes,
      });
    } catch {}
  },

  async trace<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const tracer = trace.getTracer("b2car-app");
    return tracer.startActiveSpan(name, async (otelSpan) => {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        if (error instanceof Error) {
          otelSpan.recordException(error);
          otelSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        }
        throw error;
      } finally {
        otelSpan.end();
      }
    });
  },
};
