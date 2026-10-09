import { datadogRum } from "@datadog/browser-rum";
import type { TelemetryProvider, TelemetryIdentity, TelemetryUser, TelemetryContext } from "./types";
import { compact } from "./identity";

interface DatadogSpanLike {
  setTag: (key: string, value: unknown) => void;
  context?: () => unknown;
}

export interface DatadogTracerLike {
  setUser: (user: { id?: string; [key: string]: unknown }) => unknown;
  scope: () => { active: () => DatadogSpanLike | null };
  init?: (options: Record<string, unknown>) => void;
}

let serverTracerInstance: DatadogTracerLike | null = null;
let clientInitialized = false;

/**
 * Permite registrar o inyectar la instancia de dd-trace (para Node.js o mocks de tests).
 */
export function setDatadogServerTracer(tracer: unknown): void {
  serverTracerInstance = (tracer as DatadogTracerLike) || null;
}

export function getDatadogServerTracer(): DatadogTracerLike | null {
  return serverTracerInstance;
}

/**
 * Inicializa Datadog RUM en el navegador (Frontend).
 */
export async function initDatadogClient(): Promise<void> {
  if (typeof window === "undefined" || clientInitialized) return;
  if (datadogRum.getInitConfiguration?.()) {
    clientInitialized = true;
    return;
  }

  try {
    const { reactPlugin } = await import("@datadog/browser-rum-react");

    datadogRum.init({
      applicationId: "710f917a-0f76-4db2-bf1b-6d330eefea25",
      clientToken: "pub239a3b2d8685687e70b1d432f2826018",
      site: "datadoghq.com",
      service: "b2car-frontend",
      env: process.env.NEXT_PUBLIC_DATADOG_ENV || "production",
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 100,
      traceSampleRate: 100,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      allowedTracingUrls: [
        {
          match: (url: string) => url.startsWith(`${window.location.origin}/api`),
          propagatorTypes: ["datadog", "tracecontext"],
        },
      ],
      plugins: [reactPlugin({ router: false })],
    });
    clientInitialized = true;
  } catch (error) {
    console.error("[Datadog] Error al inicializar RUM:", error);
  }
}

/**
 * Inicializa Datadog APM en Node.js (Backend).
 */
export async function initDatadogServer(): Promise<DatadogTracerLike | null> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return null;
  if (process.env.DD_TRACE_ENABLED === "false") return null;

  const apiKey = process.env.DD_API_KEY;
  if (!apiKey) return null;

  try {
    process.env.DD_AGENTLESS_ENABLED = "true";
    process.env.DD_SITE = "datadoghq.com";
    process.env.DD_API_KEY = apiKey;

    const tracerModule = (await import("dd-trace")).default;
    tracerModule.init({
      service: process.env.OTEL_SERVICE_NAME,
      env: process.env.NEXT_PUBLIC_DATADOG_ENV || "production",
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      site: "datadoghq.com",
      logInjection: true,
    });

    serverTracerInstance = tracerModule as unknown as DatadogTracerLike;
    return serverTracerInstance;
  } catch (error) {
    console.error("[Datadog] Error al inicializar APM:", error);
    return null;
  }
}

/**
 * Provider de Datadog que implementa la interfaz TelemetryProvider.
 */
export const datadogProvider: TelemetryProvider = {
  name: "datadog",

  initClient: initDatadogClient,
  initServer: initDatadogServer,

  identify({ user, account }: TelemetryIdentity): void {
    if (typeof window !== "undefined") {
      try {
        datadogRum.setUser(compact(user));
        if (account) {
          datadogRum.setAccount?.(compact(account));
        } else {
          datadogRum.clearAccount?.();
        }
      } catch {}
      return;
    }

    if (serverTracerInstance) {
      try {
        serverTracerInstance.setUser(compact(user));
        const span = serverTracerInstance.scope().active();
        if (span && account) {
          span.setTag("account.id", account.id);
          if (account.name) span.setTag("account.name", account.name);
          if (account.plan) span.setTag("account.plan", account.plan);
          span.setTag("tenant_id", account.id);
          if (account.name) span.setTag("tenant_name", account.name);
          if (account.plan) span.setTag("plan_sub", account.plan);
        }
      } catch {}
    }
  },

  setUser(user: TelemetryUser): void {
    const tenantId = user.tenant_id || user.id;
    const tenantName = user.tenant_name || user.name || undefined;
    const plan = user.plan_sub || undefined;

    if (typeof window !== "undefined") {
      try {
        const ddUser: Record<string, unknown> = { id: user.id };
        if (user.name) ddUser.name = user.name;
        if (user.email) ddUser.email = user.email;
        if (plan) ddUser.plan_sub = plan;
        datadogRum.setUser(compact(ddUser));
        if (tenantId) {
          datadogRum.setAccount?.(compact({ id: tenantId, name: tenantName, plan }));
        }
      } catch {}
      return;
    }

    if (serverTracerInstance) {
      try {
        serverTracerInstance.setUser(compact({
          id: user.id,
          name: user.name || undefined,
          email: user.email || undefined,
          plan_sub: plan,
        }));
        const span = serverTracerInstance.scope().active();
        if (span) {
          span.setTag("user.id", user.id);
          if (tenantId) span.setTag("tenant_id", tenantId);
          if (tenantName) span.setTag("tenant_name", tenantName);
          if (plan) span.setTag("plan_sub", plan);
        }
      } catch {}
    }
  },

  clearUser(): void {
    if (typeof window !== "undefined") {
      try {
        datadogRum.clearUser();
        datadogRum.clearAccount?.();
      } catch {}
    }
  },

  trackAction(name: string, context?: TelemetryContext): void {
    if (typeof window !== "undefined") {
      try {
        datadogRum.addAction(name, context);
      } catch {
      }
    }
  },

  recordException(error: Error, context?: TelemetryContext): void {
    // Browser
    if (typeof window !== "undefined") {
      try {
        datadogRum.addError(error, context);
      } catch {
      }
    }

    // Server
    if (serverTracerInstance) {
      try {
        const span = serverTracerInstance.scope().active();
        if (span) {
          span.setTag("error", true);
          span.setTag("error.message", error.message);
          if (error.stack) span.setTag("error.stack", error.stack);
          if (context) {
            for (const [k, v] of Object.entries(context)) {
              span.setTag(`error.context.${k}`, typeof v === "object" ? JSON.stringify(v) : v);
            }
          }
        }
      } catch {
      }
    }
  },
};
