import { datadogProvider } from "./telemetry/datadog";
import { honeycombProvider } from "./telemetry/honeycomb";
import type { TelemetryProvider, TelemetryIdentity, TelemetryUser, TelemetryContext, TelemetryLogLevel } from "./telemetry/types";

export * from "./telemetry/types";
export * from "./telemetry/sanitizer";
export { datadogProvider } from "./telemetry/datadog";
export {
  honeycombProvider,
  logs,
  SeverityNumber,
  HoneycombNativeSpanProcessor,
  getActiveIdentityAttributes,
  setActiveIdentity,
  clearActiveIdentity,
  ALLOWED_BAGGAGE_KEYS,
  extractClaimsFromCookieHeader,
  enrichSpan,
} from "./telemetry/honeycomb";

import { buildTelemetryAttributes } from "./telemetry/identity";
export * from "./telemetry/identity";
export const getTelemetryAttributes = buildTelemetryAttributes;


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

  log(level: TelemetryLogLevel, message: string, context?: TelemetryContext): void {
    for (const provider of providers) {
      provider.log?.(level, message, context);
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

  /**
   * Ejecuta una función dentro del contexto de identidad (propaga Baggage y atributos nativos a todos los spans creados).
   */
  async withIdentity<T>(identity: TelemetryIdentity, fn: () => Promise<T> | T): Promise<T> {
    this.identify(identity);
    const providerWithIdentity = providers.find((p) => typeof p.withIdentity === "function");
    if (providerWithIdentity && providerWithIdentity.withIdentity) {
      return await providerWithIdentity.withIdentity(identity, fn);
    }
    return await fn();
  },
};
