export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "FEATURE_NOT_AVAILABLE_FOR_PLAN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "IN_USE"
  | "STOCK_INSUFICIENTE"
  | "INMUTABLE"
  | "TIMEOUT"
  | "INTERNAL";

/** Shared API error contract. The message remains ready to display. */
export type ApiErrorBody = {
  data?: null;
  error: string;
  code: ApiErrorCode;
  /** Only on 5xx responses; also included in the server log. */
  errorId?: string;
};

export const API_ERROR_MESSAGES = {
  UNAUTHORIZED: "Tu sesión expiró. Volvé a iniciar sesión.",
  FORBIDDEN: "No tenés permisos para realizar esta acción.",
  FEATURE_NOT_AVAILABLE_FOR_PLAN: "La funcionalidad no está disponible en el plan actual.",
  CONFLICT: "Ya existe un registro con esos datos.",
  IN_USE: "No se puede eliminar porque está en uso por otros registros.",
  INVALID_REFERENCE: "Uno de los datos hace referencia a un registro que no existe.",
  INVALID_FORMAT: "Algunos datos no tienen un formato válido.",
  STOCK_INSUFICIENTE: "Stock insuficiente.",
  TIMEOUT: "La operación tardó demasiado. Intentá nuevamente.",
  INTERNAL: "Ocurrió un error inesperado.",
} as const;
