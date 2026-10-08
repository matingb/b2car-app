import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function functionDefinition(source: string): string {
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()");
  const end = source.indexOf("\n$function$;", start) + "\n$function$;".length;
  return source.slice(start, end).replace(/\s+/g, " ").trim();
}

describe("trigger FCE declarativo y migración", () => {
  it("mantiene idéntica la definición de seguridad/auditoría", () => {
    const schema = readFileSync(resolve(process.cwd(), "supabase/schemas/public/functions/facturacion_bloquear_snapshot_autorizado.sql"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261008180000_b2c_203_fce_integrity.sql"), "utf8");
    expect(functionDefinition(schema)).toBe(functionDefinition(migration));
  });
});
