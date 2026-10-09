export interface TelemetryIdentity {
  user: {
    id: string;
    role?: string;
    email?: string;
    name?: string;
    [key: string]: unknown;
  };
  account?: {
    id: string;
    name?: string;
    plan?: string;
    [key: string]: unknown;
  };
}

export interface TelemetryUser {
  id: string;
  name?: string | null;
  email?: string | null;
  plan_sub?: string | null;
  tenant_id?: string | null;
  tenant_name?: string | null;
  [key: string]: unknown;
}

export interface TelemetryContext {
  [key: string]: unknown;
}

export interface TelemetryProvider {
  readonly name: string;
  initClient?: () => unknown | Promise<unknown>;
  initServer?: () => unknown | Promise<unknown>;
  identify?: (identity: TelemetryIdentity) => void;
  setUser?: (user: TelemetryUser) => void;

  /**
   * Limpia la identidad del usuario actual.
   */
  clearUser?: () => void;

  /**
   * Registra una acción de usuario o evento de negocio.
   */
  trackAction?: (name: string, context?: TelemetryContext) => void;

  /**
   * Registra una excepción o error capturado.
   */
  recordException?: (error: Error, context?: TelemetryContext) => void;

  /**
   * Envuelve una función en una traza/span activo.
   */
  trace?: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
}
