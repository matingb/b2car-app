import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/clientes/[id]/cuenta-corriente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula saldo acumulado progresivo a partir de los datos de la RPC", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "mov-1",
          fecha: "2026-08-01T10:00:00Z",
          tipo_movimiento: "CARGO_ARREGLO",
          concepto: "Reparación frenos",
          debito: 100000,
          credito: 0,
        },
        {
          id: "mov-2",
          fecha: "2026-08-05T15:00:00Z",
          tipo_movimiento: "COBRO",
          concepto: "Cobro parcial",
          debito: 0,
          credito: 40000,
        },
      ],
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = {
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as unknown as NextRequest;

    const res = await GET(req, { params: Promise.resolve({ id: "cli-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    // Newest first (mov-2)
    expect(json.data[0].id).toBe("mov-2");
    expect(json.data[0].saldo_acumulado).toBe(60000); // 100000 - 40000

    expect(json.data[1].id).toBe("mov-1");
    expect(json.data[1].saldo_acumulado).toBe(100000);
  });
});
