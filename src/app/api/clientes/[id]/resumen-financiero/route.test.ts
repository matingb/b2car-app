import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

describe("GET /api/clientes/[id]/resumen-financiero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los datos de la RPC cuando está disponible", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        saldo_cuenta: 430000,
        saldo_a_facturar: 180000,
        total_historico_trabajos: 500000,
        total_historico_cobrado: 70000,
        cantidad_arreglos_pendientes_pago: 2,
        cantidad_arreglos_pendientes_factura: 1,
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = {} as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: "cli-123" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("rpc_cliente_resumen_financiero", {
      p_cliente_id: "cli-123",
    });
    expect(json.data).toEqual({
      saldo_cuenta: 430000,
      saldo_a_facturar: 180000,
      total_historico_trabajos: 500000,
      total_historico_cobrado: 70000,
      cantidad_arreglos_pendientes_pago: 2,
      cantidad_arreglos_pendientes_factura: 1,
    });
  });

  it("retorna 500 cuando la RPC falla", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_cliente_resumen_financiero does not exist" },
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = {} as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: "cli-123" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.data).toBeNull();
    expect(json.error).toBe("function rpc_cliente_resumen_financiero does not exist");
  });
});
