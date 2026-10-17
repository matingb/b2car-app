import { trace } from "@opentelemetry/api";
import { datadogProvider } from "./telemetry/datadog";
import { honeycombProvider } from "./telemetry/honeycomb";
import type { TelemetryProvider, TelemetryIdentity, TelemetryUser, TelemetryContext, TelemetryAttributes } from "./telemetry/types";
import { traceAttributeStore } from "./telemetry/store";

export * from "./telemetry/types";
export * from "./telemetry/store";
export { datadogProvider } from "./telemetry/datadog";
export { honeycombProvider } from "./telemetry/honeycomb";

export * from "./telemetry/identity";

function getTelemetryAttributes(identity: TelemetryIdentity): TelemetryAttributes {
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

const providers: TelemetryProvider[] = [datadogProvider, honeycombProvider];

export const telemetry = {
  getProviders(): readonly TelemetryProvider[] {
    return providers;
  },

  registerProvider(provider: TelemetryProvider): void {
    if (!providers.some((p) => p.name === provider.name)) {
      providers.push(provider);
    }
  },

  removeProvider(name: string): void {
    const idx = providers.findIndex((p) => p.name === name);
    if (idx !== -1) {
      providers.splice(idx, 1);
    }
  },

  /**
   * Inicializa todos los proveedores registrados en el navegador (Frontend).
   */
  async initClient(): Promise<void> {
    if (typeof window === "undefined") return;
    for (const provider of providers) {
      await provider.initClient?.();
    }
  },

  /**
   * Inicializa todos los proveedores registrados en el entorno del servidor (Backend).
   */
  async initServer(): Promise<void> {
    for (const provider of providers) {
      await provider.initServer?.();
    }
  },

  identify(identity: TelemetryIdentity | null): void {
    if (!identity?.user?.id) return;
    const attributes = getTelemetryAttributes(identity);
    try {
      const activeSpan = trace.getActiveSpan();
      const traceId = activeSpan?.spanContext?.()?.traceId;
      if (traceId) {
        traceAttributeStore.set(traceId, attributes);
      }
    } catch {
    }
    for (const provider of providers) {
      provider.identify?.(identity, attributes);
    }
  },

  setUser(user: TelemetryUser): void {
    if (!user || !user.id) return;
    for (const provider of providers) {
      provider.setUser?.(user);
    }
  },

  clearUser(): void {
    for (const provider of providers) {
      provider.clearUser?.();
    }
  },

  trackAction(name: string, context?: TelemetryContext): void {
    for (const provider of providers) {
      provider.trackAction?.(name, context);
    }
  },

  recordException(error: unknown, context?: TelemetryContext): void {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));

    for (const provider of providers) {
      provider.recordException?.(err, context);
    }
  },

  async trace<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const tracingProvider = providers.find((p) => typeof p.trace === "function");
    if (tracingProvider && tracingProvider.trace) {
      return tracingProvider.trace(name, fn);
    }

    try {
      return await fn();
    } catch (error) {
      this.recordException(error);
      throw error;
    }
  },
};
