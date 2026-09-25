import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/supabase/server";
import { exportFacturasRows, listFacturas } from "./facturacionService";

function createQueryChain() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "gte", "lte", "or"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled, onRejected);
  return chain;
}

describe("filtros de fecha de Facturas", () => {
  let query: ReturnType<typeof createQueryChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = createQueryChain();
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(query),
    } as never);
  });

  it("lista con ambos extremos inclusivos de la columna date, sin conversión de zona", async () => {
    await listFacturas("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });

  it("conserva los mismos extremos inclusivos en la exportación", async () => {
    await exportFacturasRows("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });
});
