import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
  requireAnyPermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

describe("GET & POST /api/clientes/[id]/cuenta-corriente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET calcula saldo acumulado progresivo a partir de los datos de la RPC", async () => {
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

  it("POST registra un COBRO directo de cliente y notifica a statsService", async () => {
    const validCliId = "e4a2a11b-7159-4d64-88aa-38e56d787090";
    const validCtaId = "11111111-2222-4333-8444-555555555555";
    const mockRpc = vi.fn().mockResolvedValue({
      data: "op-cobro-cli-1",
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = new NextRequest(
      `http://localhost/api/clientes/${validCliId}/cuenta-corriente`,
      {
        method: "POST",
        body: JSON.stringify({
          sentido: "COBRO",
          cuenta_id: validCtaId,
          monto: 60000,
          descripcion: "Cobro a cuenta",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: validCliId }) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toEqual({ id: "op-cobro-cli-1", ok: true });
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_crear_cobro_cliente",
      expect.objectContaining({
        p_cliente_id: validCliId,
        p_cuenta_id: validCtaId,
        p_monto: 60000,
      })
    );
    expect(statsService.onDataChanged).toHaveBeenCalled();
  });

  it("POST registra un PAGO / devolución a cliente invocando rpc_crear_pago_cliente", async () => {
    const validCliId = "e4a2a11b-7159-4d64-88aa-38e56d787090";
    const validCtaId = "11111111-2222-4333-8444-555555555555";
    const mockRpc = vi.fn().mockResolvedValue({
      data: "op-pago-cli-1",
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = new NextRequest(
      `http://localhost/api/clientes/${validCliId}/cuenta-corriente`,
      {
        method: "POST",
        body: JSON.stringify({
          sentido: "PAGO",
          cuenta_id: validCtaId,
          monto: 15000,
          descripcion: "Devolución de saldo a favor",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: validCliId }) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toEqual({ id: "op-pago-cli-1", ok: true });
    expect(mockRpc).toHaveBeenCalledWith(
      "rpc_crear_pago_cliente",
      expect.objectContaining({
        p_cliente_id: validCliId,
        p_cuenta_id: validCtaId,
        p_monto: 15000,
      })
    );
  });

  it("POST retorna 400 cuando el sentido o el clienteId son inválidos", async () => {
    const validCliId = "e4a2a11b-7159-4d64-88aa-38e56d787090";
    const validCtaId = "11111111-2222-4333-8444-555555555555";

    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const reqInvalidSentido = new NextRequest(
      `http://localhost/api/clientes/${validCliId}/cuenta-corriente`,
      {
        method: "POST",
        body: JSON.stringify({
          sentido: "INVALIDO",
          cuenta_id: validCtaId,
          monto: 1000,
        }),
      }
    );
    const res1 = await POST(reqInvalidSentido, {
      params: Promise.resolve({ id: validCliId }),
    });
    expect(res1.status).toBe(400);

    const reqInvalidId = new NextRequest(
      "http://localhost/api/clientes/not-a-uuid/cuenta-corriente",
      {
        method: "POST",
        body: JSON.stringify({
          cuenta_id: validCtaId,
          monto: 1000,
        }),
      }
    );
    const res2 = await POST(reqInvalidId, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res2.status).toBe(400);
  });
});
