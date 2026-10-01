import "server-only";

import { isValidUuid } from "@/lib/uuid";
import { ApiError } from "./apiError";

export type Validated<T> = { value?: T; error?: string };
export type Parser<T, Raw = unknown> = (raw: Raw) => Validated<T>;

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "JSON inválido", "VALIDATION");
  }
}

export function parseInput<T, Raw>(parser: Parser<T, Raw>, raw: Raw): T {
  const parsed = parser(raw);
  if (parsed.error || parsed.value === undefined) {
    throw new ApiError(400, parsed.error || "Datos inválidos", "VALIDATION");
  }
  return parsed.value;
}

export function uuidParams<K extends string>(...keys: K[]): Parser<Record<K, string>, Record<string, string>> {
  return (raw) => {
    const value = {} as Record<K, string>;
    for (const key of keys) {
      if (!isValidUuid(raw[key])) return { error: `El parámetro ${key} debe ser un UUID válido` };
      value[key] = raw[key];
    }
    return { value };
  };
}
