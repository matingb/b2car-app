import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { TelemetryProvider, TelemetryIdentity, TelemetryUser, TelemetryContext } from "./types";

let clientInitialized = false;
let serverInitialized = false;

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

    const sdk = new NodeSDK({
      serviceName,
      resource: resourceFromAttributes({
        [ATTR_SERVICE_VERSION]: appVersion,
        "deployment.environment": environment,
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false,
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
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
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

  identify({ user, account }: TelemetryIdentity): void {
    try {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttribute("user.id", user.id);
        if (user.role) span.setAttribute("user.role", String(user.role));
        if (user.email) span.setAttribute("user.email", String(user.email));

        if (account) {
          span.setAttribute("account.id", account.id);
          span.setAttribute("tenant_id", account.id);
          if (account.name) {
            span.setAttribute("account.name", String(account.name));
            span.setAttribute("tenant_name", String(account.name));
          }
          if (account.plan) {
            span.setAttribute("account.plan", String(account.plan));
            span.setAttribute("plan_sub", String(account.plan));
          }
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
