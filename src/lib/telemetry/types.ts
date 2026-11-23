export interface TelemetryIdentity {
  user: {
    id: string;
    role?: string;
    email?: string;
    [key: string]: unknown;
  };
  account?: {
    id: string;
    name?: string;
    plan?: string;
    [key: string]: unknown;
  };
}

export type TelemetryAttributes = Record<string, string | number | boolean>;

export interface TelemetryContext {
  [key: string]: unknown;
}

export type TelemetryLogLevel = "debug" | "info" | "warn" | "error";

export interface TelemetryProvider {
  readonly name: string;
  initClient?: () => unknown | Promise<unknown>;
  initServer?: () => unknown | Promise<unknown>;
  identify?: (identity: TelemetryIdentity, attributes?: TelemetryAttributes) => void;

  /**
   * Limpia la identidad del usuario actual.
   */
  clearUser?: () => void;

  /**
   * Adjunta atributos estructurados al span activo (y al span raíz del trace en servidor).
   */
  setAttributes?: (attributes: TelemetryContext) => void;

  /**
   * Registra una excepción o error capturado.
   */
  recordException?: (error: Error, context?: TelemetryContext) => void;

  /**
   * Registra un log con severidad, mensaje y contexto estructurado.
   */
  log?: (level: TelemetryLogLevel, message: string, context?: TelemetryContext) => void;

  /**
   * Envuelve una función en una traza/span activo.
   */
  trace?: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;

  /**
   * Ejecuta una función dentro del contexto de identidad (Baggage y atributos propagados en todos los spans hijos).
   */
  withIdentity?: <T>(identity: TelemetryIdentity, fn: () => Promise<T> | T) => Promise<T>;
}
