export const SENSITIVE_ATTRIBUTES = [
  // Contraseñas
  "password",
  "confirm_password",

  // Tokens y autorización
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "api_key",

  // Certificados y firmas fiscales
  "cert",
  "key",
  "sign",

  // PII en B2Car
  "dni",
  "dni_cuil",
  "telefono",
  "direccion",
  "email",

  // CBU fiscal en facturación electrónica
  "fce_cbu",
] as const;

const SENSITIVE_NORMALIZED = new Set(
  SENSITIVE_ATTRIBUTES.map((attr) => attr.replace(/[-_]/g, "")),
);

export function isSensitiveAttribute(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const normalized = name.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_NORMALIZED.has(normalized);
}

// Patrones en strings (para proteger errores de conexión con credenciales o headers)
const URI_CREDENTIALS_REGEX = /(:\/\/[^:]+:)([^@]+)(@)/g;
const BEARER_AUTH_REGEX = /((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/-]+=*/gi;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/g;
const QUERY_PARAM_SENSITIVE_REGEX = /([?&](?:password|token|access_token|refresh_token)=)([^&]+)/gi;

export function sanitizeString(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(URI_CREDENTIALS_REGEX, "$1[REDACTED]$3")
    .replace(BEARER_AUTH_REGEX, "$1[REDACTED]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(QUERY_PARAM_SENSITIVE_REGEX, "$1[REDACTED]");
}

function sanitizeError(error: Error, seen: WeakSet<object>, depth = 0): Error {
  if (seen.has(error)) return error;
  seen.add(error);

  const sanitizedMessage = sanitizeString(error.message);
  if (sanitizedMessage !== error.message) {
    error.message = sanitizedMessage;
  }

  if (error.stack) {
    const sanitizedStack = sanitizeString(error.stack);
    if (sanitizedStack !== error.stack) {
      error.stack = sanitizedStack;
    }
  }

  for (const key of Object.keys(error)) {
    if (key === "name" || key === "message" || key === "stack") continue;
    const val = (error as Record<string, unknown>)[key];
    if (isSensitiveAttribute(key)) {
      (error as Record<string, unknown>)[key] = "[REDACTED]";
    } else {
      (error as Record<string, unknown>)[key] = sanitizeValue(val, seen, depth + 1);
    }
  }

  return error;
}

/**
 * Sanitiza recursivamente el contenido de los atributos sensibles que utiliza B2Car.
 * No agrega atributos adicionales; mantiene exactamente la misma estructura de claves.
 */
export function sanitizeValue<T>(
  value: T,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value) as unknown as T;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value, seen, depth) as unknown as T;
  }

  if (typeof value === "object") {
    if (depth > 8) {
      return "[DepthLimit]" as unknown as T;
    }

    if (seen.has(value as object)) {
      return "[Circular]" as unknown as T;
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, seen, depth + 1)) as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveAttribute(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitizeValue(v, seen, depth + 1);
      }
    }
    return result as unknown as T;
  }

  return value;
}

export function sanitizeLogArgs(args: unknown[]): unknown[] {
  const seen = new WeakSet<object>();
  return args.map((arg) => sanitizeValue(arg, seen, 0));
}
