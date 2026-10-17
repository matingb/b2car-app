import { trace, SpanStatusCode, type Context } from "@opentelemetry/api";
import type { SpanProcessor, ReadableSpan, Span } from "@opentelemetry/sdk-trace-base";
import type {
  TelemetryProvider,
  TelemetryIdentity,
  TelemetryUser,
  TelemetryContext,
  TelemetryAttributes,
} from "./types";
import { traceAttributeStore, TraceAttributeStore } from "./store";

export { traceAttributeStore, TraceAttributeStore };

let clientInitialized = false;
let serverInitialized = false;

export class RootEnrichmentSpanProcessor implements SpanProcessor {
  constructor(private store: TraceAttributeStore = traceAttributeStore) {}

  onStart(span: Span, _parentContext: Context): void {
    const traceId = span.spanContext().traceId;
    const attrs = this.store.get(traceId);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        span.setAttribute(k, v);
      }
    }
  }

  onEnd(span: ReadableSpan): void {
    const traceId = span.spanContext().traceId;
    const attrs = this.store.get(traceId);
    if (!attrs) return;

    const isRoot = !span.parentSpanContext || (span.parentSpanContext as { isRemote?: boolean }).isRemote;
    if (isRoot) {
      const mutableSpan = span as unknown as { attributes: Record<string, unknown> };
      if (mutableSpan.attributes) {
        for (const [k, v] of Object.entries(attrs)) {
          if (mutableSpan.attributes[k] === undefined) {
            mutableSpan.attributes[k] = v;
          }
        }
      }
      this.store.delete(traceId);
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Genera el mapa de atributos estándar a partir de una identidad.
 */
function buildTelemetryAttributes(identity: TelemetryIdentity): TelemetryAttributes {
  const attrs: TelemetryAttributes = {
    "user.id": identity.user.id,
  };
  if (identity.user.email) attrs["user.email"] = String(identity.user.email);
  if (identity.user.role) attrs["user.role"] = String(identity.user.role);
  if (identity.user.name) attrs["user.name"] = String(identity.user.name);

  if (identity.account) {
    attrs["tenant.id"] = String(identity.account.id);
    if (identity.account.name) attrs["tenant.name"] = String(identity.account.name);
    if (identity.account.plan) attrs["tenant.plan"] = String(identity.account.plan);
  }
  return attrs;
}

/**
 * Inicializa Honeycomb Web SDK en el navegador (Frontend).
 */
export async function initHoneycombClient(): Promise<void> {
  if (typeof window === "undefined" || clientInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
  if (!apiKey) return;

  try {
    const { HoneycombWebSDK } = await import("@honeycombio/opentelemetry-web");
    const sdk = new HoneycombWebSDK({
      apiKey,
      serviceName: process.env.NEXT_PUBLIC_TELEMETRY_FRONTEND_SERVICE_NAME!,
    });

    sdk.start();
    clientInitialized = true;
  } catch (error) {
    console.error("[Honeycomb] Error al inicializar Web SDK en el cliente:", error);
  }
}

/**
 * Inicializa Honeycomb OpenTelemetry NodeSDK en Node.js (Backend).
 */
export async function initHoneycombServer(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || serverInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
  if (!apiKey && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

    const endpoint = "https://api.honeycomb.io/v1/traces";
    const serviceName = process.env.TELEMETRY_BACKEND_SERVICE_NAME || "b2car-backend";
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    const environment = process.env.NEXT_PUBLIC_DATADOG_ENV || process.env.NODE_ENV || "production";

    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
      headers: apiKey
        ? {
            "x-honeycomb-team": apiKey,
            ...(process.env.HONEYCOMB_DATASET ? { "x-honeycomb-dataset": process.env.HONEYCOMB_DATASET } : {}),
          }
        : undefined,
    });

    const rootProcessor = new RootEnrichmentSpanProcessor(traceAttributeStore);

    const sdk = new NodeSDK({
      serviceName,
      resource: resourceFromAttributes({
        [ATTR_SERVICE_VERSION]: appVersion,
        "deployment.environment": environment,
      }),
      traceExporter,
      spanProcessors: [rootProcessor],
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false,
          },
          "@opentelemetry/instrumentation-http": {
            requestHook: (span, request) => {
              try {
                const incomingReq = request as import("http").IncomingMessage;
                const url = incomingReq.url || "";
                if (url.startsWith("/api/")) {
                  span.setAttribute("api.route", url.split("?")[0]);
                }
              } catch {
                // Silencioso
              }
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

/**
 * Sanitiza atributos para eventos de OpenTelemetry (deben ser string, number o boolean).
 */
function sanitizeEventAttributes(
  context?: TelemetryContext,
): Record<string, string | number | boolean> {
  if (!context) return {};
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else {
      sanitized[key] = JSON.stringify(value);
    }
  }
  return sanitized;
}

/**
 * Provider de Honeycomb que implementa la interfaz TelemetryProvider.
 */
export const honeycombProvider: TelemetryProvider = {
  name: "honeycomb",

  initClient: initHoneycombClient,
  initServer: initHoneycombServer,

  identify(identity: TelemetryIdentity, attributes?: TelemetryAttributes): void {
    try {
      const attrs = attributes ?? buildTelemetryAttributes(identity);
      const span = trace.getActiveSpan();
      if (span) {
        const traceId = span.spanContext?.()?.traceId;
        if (traceId) {
          traceAttributeStore.set(traceId, attrs);
        }
        for (const [key, value] of Object.entries(attrs)) {
          span.setAttribute(key, value);
        }
      }
    } catch {}
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
    // Los spans de OpenTelemetry son efímeros y contextuales
  },

  trackAction(name: string, context?: TelemetryContext): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        span.addEvent(name, sanitizeEventAttributes(context));
      }
    } catch {
      // Silencioso
    }
  },

  recordException(error: Error, context?: TelemetryContext): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        if (context) {
          for (const [k, v] of Object.entries(context)) {
            if (v !== undefined && v !== null) {
              span.setAttribute(
                `error.context.${k}`,
                typeof v === "object" ? JSON.stringify(v) : String(v),
              );
            }
          }
        }
      }
    } catch {
      // Silencioso
    }
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
