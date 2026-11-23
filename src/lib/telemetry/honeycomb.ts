import {
  trace,
  context,
  createContextKey,
  propagation,
  SpanStatusCode,
  type Span,
  type Context,
  type TextMapPropagator,
  type TextMapGetter,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { Span as SdkSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
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

/**
 * Only non-PII operational identifiers may travel in W3C Baggage HTTP headers.
 * Personal attributes (such as `user.email`) stay in-process via
 * `IDENTITY_CONTEXT_KEY`, `AsyncLocalStorage`, and `traceIdentityMap`.
 */
export const ALLOWED_BAGGAGE_KEYS = new Set([
  "user.id",
  "user.role",
  "tenant.id",
  "tenant.name",
  "tenant.plan",
]);

const IDENTITY_CONTEXT_KEY = createContextKey("b2car.telemetry.identity");

function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined";
}

function mergeIdentityAttributes(
  existing: TelemetryAttributes | null | undefined,
  incoming: TelemetryAttributes | null | undefined,
): TelemetryAttributes | null {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing && Object.keys(existing).length > 0 ? { ...existing } : null;
  }
  if (!existing || Object.keys(existing).length === 0) {
    return { ...incoming };
  }
  const sameUser =
    !existing["user.id"] || !incoming["user.id"] || existing["user.id"] === incoming["user.id"];
  const sameTenant =
    !existing["tenant.id"] || !incoming["tenant.id"] || existing["tenant.id"] === incoming["tenant.id"];
  if (sameUser && sameTenant) {
    return { ...existing, ...incoming };
  }
  return { ...incoming };
}

const MAX_TRACE_IDENTITIES = 2000;
const traceIdentityMap = new Map<string, TelemetryAttributes>();

function isValidTraceId(traceId?: string): traceId is string {
  return Boolean(traceId && traceId !== "00000000000000000000000000000000");
}

function getSpanTraceId(
  span?: { spanContext?: () => { traceId?: string } } | null,
): string | undefined {
  try {
    const traceId = span?.spanContext?.()?.traceId;
    return isValidTraceId(traceId) ? traceId : undefined;
  } catch {
    return undefined;
  }
}

function setTraceIdentity(
  traceId: string | undefined,
  attrs: TelemetryAttributes | null,
): TelemetryAttributes | null {
  if (!attrs || Object.keys(attrs).length === 0 || !isValidTraceId(traceId)) {
    return attrs;
  }
  const existing = traceIdentityMap.get(traceId);
  const merged = mergeIdentityAttributes(existing, attrs);
  if (!merged) return null;
  traceIdentityMap.delete(traceId);
  traceIdentityMap.set(traceId, merged);
  if (traceIdentityMap.size > MAX_TRACE_IDENTITIES) {
    const oldestKey = traceIdentityMap.keys().next().value;
    if (oldestKey) traceIdentityMap.delete(oldestKey);
  }
  return merged;
}

function extractBaggageAttributes(ctx: Context): TelemetryAttributes | null {
  try {
    const baggage = propagation.getBaggage(ctx);
    if (!baggage) return null;
    const extracted: TelemetryAttributes = {};
    for (const [key, entry] of baggage.getAllEntries()) {
      if (ALLOWED_BAGGAGE_KEYS.has(key) && entry.value) {
        extracted[key] = entry.value;
      }
    }
    return Object.keys(extracted).length > 0 ? extracted : null;
  } catch {
    return null;
  }
}

function extractContextIdentityAttributes(ctx: Context): TelemetryAttributes | null {
  try {
    const value = ctx.getValue(IDENTITY_CONTEXT_KEY);
    if (!value || typeof value !== "object") return null;
    const attrs = value as TelemetryAttributes;
    return Object.keys(attrs).length > 0 ? attrs : null;
  } catch {
    return null;
  }
}

let clientIdentityAttributes: TelemetryAttributes | null = null;
let clientIdentityCleared = false;
type AsyncLocalStorageType = import("node:async_hooks").AsyncLocalStorage<TelemetryAttributes>;
let serverIdentityStorage: AsyncLocalStorageType | null = null;

if (typeof window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncHooks = require("node:async_hooks") as typeof import("node:async_hooks");
    serverIdentityStorage = new asyncHooks.AsyncLocalStorage<TelemetryAttributes>();
  } catch {}
}

function tryHydrateClientIdentityFromCookie(): TelemetryAttributes | null {
  if (!isBrowserEnvironment() || typeof document === "undefined" || !document.cookie) {
    return null;
  }
  try {
    const claims = extractClaimsFromCookieHeader(document.cookie);
    const identity = identityFromClaims(claims);
    if (!identity) return null;
    return buildTelemetryAttributes(identity);
  } catch {
    return null;
  }
}

export function getActiveIdentityAttributes(
  ctx: Context = context.active(),
  spanTraceId?: string,
): TelemetryAttributes | null {
  let resolved: TelemetryAttributes | null = null;

  const fromBaggage = extractBaggageAttributes(ctx);
  if (fromBaggage) {
    resolved = mergeIdentityAttributes(resolved, fromBaggage);
  }

  const fromContext = extractContextIdentityAttributes(ctx);
  if (fromContext) {
    resolved = mergeIdentityAttributes(resolved, fromContext);
  }

  const effectiveTraceId = spanTraceId ?? getSpanTraceId(trace.getActiveSpan());
  if (effectiveTraceId) {
    const fromTrace = traceIdentityMap.get(effectiveTraceId);
    if (fromTrace) {
      resolved = mergeIdentityAttributes(resolved, fromTrace);
    }
  }

  const fromStore = serverIdentityStorage?.getStore();
  if (fromStore && Object.keys(fromStore).length > 0) {
    resolved = mergeIdentityAttributes(resolved, fromStore);
  }

  if (isBrowserEnvironment()) {
    if (!clientIdentityAttributes && !clientIdentityCleared) {
      const hydrated = tryHydrateClientIdentityFromCookie();
      if (hydrated) {
        clientIdentityAttributes = hydrated;
      }
    }
    if (clientIdentityAttributes) {
      resolved = mergeIdentityAttributes(resolved, clientIdentityAttributes);
    }
  }

  return resolved;
}

function createIdentityBaggage(attrs: TelemetryAttributes, parentContext = context.active()) {
  let baggage = propagation.getBaggage(parentContext) || propagation.createBaggage();
  for (const [k, v] of Object.entries(attrs)) {
    if (ALLOWED_BAGGAGE_KEYS.has(k) && v !== undefined && v !== null && v !== "") {
      baggage = baggage.setEntry(k, { value: String(v) });
    }
  }
  return baggage;
}

function applyIdentityToContext(ctx: Context, attrs: TelemetryAttributes): Context {
  const ctxWithIdentity = ctx.setValue(IDENTITY_CONTEXT_KEY, attrs);
  try {
    return propagation.setBaggage(ctxWithIdentity, createIdentityBaggage(attrs, ctxWithIdentity));
  } catch {
    return ctxWithIdentity;
  }
}

export function setActiveIdentity(attrs: TelemetryAttributes | null): void {
  if (!attrs || Object.keys(attrs).length === 0) {
    clearActiveIdentity();
    return;
  }

  const activeTraceId = getSpanTraceId(trace.getActiveSpan());
  const existing = getActiveIdentityAttributes(context.active(), activeTraceId);
  const merged = mergeIdentityAttributes(existing, attrs) ?? attrs;

  if (isBrowserEnvironment()) {
    clientIdentityCleared = false;
    clientIdentityAttributes = merged;
  }

  if (activeTraceId) {
    setTraceIdentity(activeTraceId, merged);
  }

  if (serverIdentityStorage) {
    serverIdentityStorage.enterWith(merged);
  }
}

export function clearActiveIdentity(): void {
  if (isBrowserEnvironment()) {
    clientIdentityAttributes = null;
    clientIdentityCleared = true;
    traceIdentityMap.clear();
  } else {
    const activeTraceId = getSpanTraceId(trace.getActiveSpan());
    if (activeTraceId) {
      traceIdentityMap.delete(activeTraceId);
    }
  }

  if (serverIdentityStorage) {
    serverIdentityStorage.enterWith({});
  }
}

export function enrichSpan(span?: Span | null, attrs?: TelemetryAttributes | null): void {
  if (!span || !attrs) return;
  try {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null && value !== "") {
        span.setAttribute(key, value);
      }
    }
  } catch {}
}

export class SupabaseCookieIdentityPropagator implements TextMapPropagator {
  inject(): void {}

  extract(ctx: Context, carrier: unknown, getter: TextMapGetter): Context {
    if (!carrier) return ctx;
    try {
      const rawCookie = getter.get(carrier, "cookie") ?? getter.get(carrier, "Cookie");
      const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
      if (!cookieHeader) {
        return ctx;
      }

      const claims = extractClaimsFromCookieHeader(cookieHeader);
      const identity = identityFromClaims(claims);
      if (!identity) {
        return ctx;
      }

      const attrs = buildTelemetryAttributes(identity);
      return applyIdentityToContext(ctx, attrs);
    } catch {
      return ctx;
    }
  }

  fields(): string[] {
    return ["cookie"];
  }
}

export class HoneycombNativeSpanProcessor implements SpanProcessor {
  onStart(span: SdkSpan, parentContext: Context): void {
    const traceId = getSpanTraceId(span);
    const baggageAttrs = extractBaggageAttributes(parentContext);
    if (baggageAttrs) {
      setTraceIdentity(traceId, baggageAttrs);
      enrichSpan(span, baggageAttrs);
    }

    const contextAttrs = extractContextIdentityAttributes(parentContext);
    if (contextAttrs) {
      setTraceIdentity(traceId, contextAttrs);
      enrichSpan(span, contextAttrs);
    }

    const activeAttrs = getActiveIdentityAttributes(parentContext, traceId);
    if (activeAttrs) {
      setTraceIdentity(traceId, activeAttrs);
      enrichSpan(span, activeAttrs);
    }
  }

  onEnding(span: SdkSpan): void {
    try {
      const traceId = getSpanTraceId(span);
      const activeAttrs = getActiveIdentityAttributes(context.active(), traceId);
      if (!activeAttrs) return;

      const existingAttrs = (span as unknown as { attributes?: Record<string, unknown> }).attributes;
      for (const [key, value] of Object.entries(activeAttrs)) {
        if (
          existingAttrs?.[key] === undefined &&
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          span.setAttribute(key, value);
        }
      }
    } catch {}
  }

  onEnd(): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function initHoneycombClient(): Promise<void> {
  if (!isBrowserEnvironment() || clientInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
  const endpoint = process.env.NEXT_PUBLIC_HONEYCOMB_ENDPOINT;
  if (!apiKey && !endpoint) return;

  try {
    if (!clientIdentityAttributes && !clientIdentityCleared) {
      const hydrated = tryHydrateClientIdentityFromCookie();
      if (hydrated) {
        clientIdentityAttributes = hydrated;
      }
    }

    const { HoneycombWebSDK } = await import("@honeycombio/opentelemetry-web");
    const { getWebAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-web");

    const ignoreUrls: Array<string | RegExp> = [/api(\.eu1)?\.honeycomb\.io/i];
    if (endpoint) {
      ignoreUrls.push(new RegExp(escapeRegExp(endpoint.replace(/\/+$/, "")), "i"));
    }

    const sdk = new HoneycombWebSDK({
      ...(apiKey ? { apiKey } : { skipOptionsValidation: true }),
      ...(endpoint ? { endpoint } : {}),
      serviceName: process.env.NEXT_PUBLIC_TELEMETRY_FRONTEND_SERVICE_NAME || "b2car-frontend",
      ...(process.env.NEXT_PUBLIC_APP_VERSION
        ? { serviceVersion: process.env.NEXT_PUBLIC_APP_VERSION }
        : {}),
      instrumentations: [
        getWebAutoInstrumentations({
          "@opentelemetry/instrumentation-fetch": {
            ignoreUrls,
          },
          "@opentelemetry/instrumentation-xml-http-request": {
            ignoreUrls,
          },
        }),
      ],
      spanProcessors: [new HoneycombNativeSpanProcessor()],
    });

    sdk.start();
    clientInitialized = true;
  } catch (error) {
    console.error("[Honeycomb] Error al inicializar Web SDK en el cliente:", error);
  }
}

function decodeBase64UrlString(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64url").toString("utf8");
  }
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getCookieChunkOrder(cookiePart: string): number {
  const eqIndex = cookiePart.indexOf("=");
  const name = eqIndex === -1 ? cookiePart : cookiePart.slice(0, eqIndex);
  const match = /\.(\d+)$/.exec(name);
  return match ? Number(match[1]) : -1;
}

export function extractClaimsFromCookieHeader(cookieHeader?: string): Record<string, unknown> | null {
  if (!cookieHeader) return null;

  try {
    const tokenChunks = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter((part) => {
        const eqIndex = part.indexOf("=");
        if (eqIndex <= 0) return false;
        const name = part.slice(0, eqIndex);
        return name.startsWith("sb-") && name.includes("-auth-token");
      })
      .sort((a, b) => {
        const orderDiff = getCookieChunkOrder(a) - getCookieChunkOrder(b);
        return orderDiff !== 0 ? orderDiff : a.localeCompare(b);
      })
      .map((part) => part.slice(part.indexOf("=") + 1));

    if (tokenChunks.length === 0) return null;

    let raw = decodeURIComponent(tokenChunks.join(""));
    if (raw.startsWith("base64-")) {
      raw = decodeBase64UrlString(raw.slice(7));
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

function buildOtlpSignalEndpoint(baseOrFullEndpoint: string | undefined, signalPath: string): string {
  const base = (baseOrFullEndpoint || "https://api.honeycomb.io").trim().replace(/\/+$/, "");
  return base.endsWith(signalPath) ? base : `${base}${signalPath}`;
}

function parseHostname(urlString?: string): string | null {
  if (!urlString) return null;
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function initHoneycombServer(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (serverInitialized) return;

    const apiKey = process.env.HONEYCOMB_API_KEY || process.env.NEXT_PUBLIC_HONEYCOMB_API_KEY;
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!apiKey && !otlpEndpoint) return;

    try {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
      const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
      const { OTLPLogExporter } = await import("@opentelemetry/exporter-logs-otlp-http");
      const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");
      const { BatchLogRecordProcessor } = await import("@opentelemetry/sdk-logs");
      const { defaultResource, resourceFromAttributes } = await import("@opentelemetry/resources");
      const { ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } = await import(
        "@opentelemetry/semantic-conventions"
      );
      const { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } = await import(
        "@opentelemetry/core"
      );

      const tracesEndpoint =
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
        buildOtlpSignalEndpoint(otlpEndpoint, "/v1/traces");
      const logsEndpoint =
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
        buildOtlpSignalEndpoint(otlpEndpoint, "/v1/logs");
      const serviceName = process.env.TELEMETRY_BACKEND_SERVICE_NAME || "b2car-backend";
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
      const environment = process.env.NODE_ENV || "production";
      const otlpHost = parseHostname(tracesEndpoint) || parseHostname(otlpEndpoint);

      const headers = apiKey
        ? {
            "x-honeycomb-team": apiKey,
            ...(process.env.HONEYCOMB_DATASET
              ? { "x-honeycomb-dataset": process.env.HONEYCOMB_DATASET }
              : {}),
          }
        : undefined;

      const traceExporter = new OTLPTraceExporter({
        url: tracesEndpoint,
        headers,
      });

      const logExporter = new OTLPLogExporter({
        url: logsEndpoint,
        headers,
      });

      const sdk = new NodeSDK({
        serviceName,
        resource: defaultResource().merge(
          resourceFromAttributes({
            ...(appVersion ? { [ATTR_SERVICE_VERSION]: appVersion } : {}),
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
          }),
        ),
        metricReaders: [],
        textMapPropagator: new CompositePropagator({
          propagators: [
            new W3CTraceContextPropagator(),
            new W3CBaggagePropagator(),
            new SupabaseCookieIdentityPropagator(),
          ],
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
              ignoreOutgoingRequestHook: (req) => {
                const headerHost =
                  req.headers && !Array.isArray(req.headers)
                    ? (req.headers as Record<string, unknown>).host
                    : undefined;
                const rawHost =
                  req.hostname ||
                  req.host ||
                  (typeof headerHost === "string" ? headerHost : "");
                const host = rawHost.split(":")[0].toLowerCase();
                if (!host) return false;
                if (host.endsWith(".honeycomb.io")) return true;
                return Boolean(otlpHost && host === otlpHost);
              },
              requestHook: (span, request) => {
                try {
                  if (!("headers" in request)) return;
                  const req = request as import("http").IncomingMessage;
                  if (req.url?.startsWith("/api/")) {
                    span.setAttribute("api.route", req.url.split("?")[0]);
                  }

                  const traceId = getSpanTraceId(span);
                  let activeAttrs = getActiveIdentityAttributes(context.active(), traceId);

                  if (!activeAttrs) {
                    const claims = extractClaimsFromCookieHeader(req.headers?.cookie);
                    if (claims) {
                      const identity = identityFromClaims(claims);
                      if (identity) {
                        activeAttrs = buildTelemetryAttributes(identity);
                      }
                    }
                  }

                  if (activeAttrs) {
                    setTraceIdentity(traceId, activeAttrs);
                    if (serverIdentityStorage) {
                      serverIdentityStorage.enterWith(activeAttrs);
                    }
                    enrichSpan(span, activeAttrs);
                  }
                } catch {}
              },
              responseHook: (span) => {
                enrichSpan(span, getActiveIdentityAttributes(context.active(), getSpanTraceId(span)));
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
}

function toOtelAttributes(
  contextData?: TelemetryContext,
): Record<string, string | number | boolean> {
  if (!contextData) return {};
  const formatted: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(contextData)) {
    if (value === undefined || value === null) continue;
    if (ALLOWED_BAGGAGE_KEYS.has(key) && value === "") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      formatted[key] = value;
    } else {
      formatted[key] = JSON.stringify(value);
    }
  }
  return formatted;
}

let cachedLoggerProvider: ReturnType<typeof logs.getLoggerProvider> | null = null;
let cachedLogger: ReturnType<typeof logs.getLogger> | null = null;

function getAppLogger() {
  const provider = logs.getLoggerProvider();
  if (!cachedLogger || cachedLoggerProvider !== provider) {
    cachedLoggerProvider = provider;
    cachedLogger = logs.getLogger("b2car-app");
  }
  return cachedLogger;
}

export const honeycombProvider: TelemetryProvider = {
  name: "honeycomb",

  initClient: initHoneycombClient,
  initServer: initHoneycombServer,

  identify(identity: TelemetryIdentity, attributes?: TelemetryAttributes): void {
    const rawAttrs = attributes ?? buildTelemetryAttributes(identity);
    setActiveIdentity(rawAttrs);
    const activeSpan = trace.getActiveSpan() as Span | undefined;
    const resolved = getActiveIdentityAttributes(context.active(), getSpanTraceId(activeSpan)) ?? rawAttrs;
    enrichSpan(activeSpan, resolved);
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
    const rawAttrs = buildTelemetryAttributes(identity);
    const activeSpan = trace.getActiveSpan() as Span | undefined;
    const activeTraceId = getSpanTraceId(activeSpan);
    const existing = getActiveIdentityAttributes(context.active(), activeTraceId);
    const attrs = mergeIdentityAttributes(existing, rawAttrs) ?? rawAttrs;

    setActiveIdentity(attrs);
    enrichSpan(activeSpan, attrs);

    const newContext = applyIdentityToContext(context.active(), attrs);
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
        const activeIdentityAttrs = getActiveIdentityAttributes(context.active(), getSpanTraceId(span));
        span.addEvent(name, {
          ...toOtelAttributes(contextData),
          ...toOtelAttributes(activeIdentityAttrs ?? undefined),
        });
      }
    } catch {}
  },

  recordException(error: Error, contextData?: TelemetryContext): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        enrichSpan(span as Span, getActiveIdentityAttributes(context.active(), getSpanTraceId(span)));
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
      const span = trace.getActiveSpan();
      const activeIdentityAttrs = getActiveIdentityAttributes(context.active(), getSpanTraceId(span));
      const eventName = message || `log_${level}`;
      const attributes = {
        ...toOtelAttributes({
          severity: level,
          ...contextData,
        }),
        ...toOtelAttributes(activeIdentityAttrs ?? undefined),
      };

      if (span) {
        span.addEvent(eventName, attributes);
      }

      const severityMap: Record<TelemetryLogLevel, { number: SeverityNumber; text: string }> = {
        debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
        info: { number: SeverityNumber.INFO, text: "INFO" },
        warn: { number: SeverityNumber.WARN, text: "WARN" },
        error: { number: SeverityNumber.ERROR, text: "ERROR" },
      };

      const sev = severityMap[level] ?? { number: SeverityNumber.INFO, text: "INFO" };
      getAppLogger().emit({
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
        const err = error instanceof Error ? error : new Error(String(error));
        otelSpan.recordException(err);
        otelSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw error;
      } finally {
        otelSpan.end();
      }
    });
  },
};
