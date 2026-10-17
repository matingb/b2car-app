import type { TelemetryAttributes } from "./types";

export const DEFAULT_TELEMETRY_TTL_MS = 60_000; // 1 minuto

export interface CachedTraceAttributes {
  attributes: TelemetryAttributes;
  expiresAt: number;
}

/**
 * Almacén en memoria de atributos por traceId con TTL (por defecto 1 minuto).
 * Permite correlacionar el contexto de identidad (usuario, tenant, plan)
 * con la traza a lo largo del ciclo de vida de la petición en el backend.
 */
export class TraceAttributeStore {
  private cache = new Map<string, CachedTraceAttributes>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TELEMETRY_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  set(traceId: string, attributes: TelemetryAttributes): void {
    this.cleanup();
    const existing = this.cache.get(traceId)?.attributes || {};
    this.cache.set(traceId, {
      attributes: { ...existing, ...attributes },
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(traceId: string): TelemetryAttributes | undefined {
    const item = this.cache.get(traceId);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(traceId);
      return undefined;
    }
    return item.attributes;
  }

  delete(traceId: string): void {
    this.cache.delete(traceId);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [id, item] of this.cache.entries()) {
        if (now > item.expiresAt) {
          this.cache.delete(id);
        }
      }
    }
  }
}

export const traceAttributeStore = new TraceAttributeStore(DEFAULT_TELEMETRY_TTL_MS);
