import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createClient } from "@/supabase/server";
import type { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
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

  it("ejecuta el cálculo fallback excluyendo no facturables y facturados cuando la RPC no existe", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_cliente_resumen_financiero does not exist" },
    });

    const mockVehiculos = [{ id: "veh-1" }];
    const mockArreglos = [
      {
        id: "arr-1",
        precio_final: 200000,
        total_cobrado: 50000,
        esta_pago: false,
        estado: "EN_PROCESO",
        es_facturable: true,
        cliente_id: "cli-123",
        vehiculo_id: "veh-1",
      },
      {
        id: "arr-2", // No facturable
        precio_final: 100000,
        total_cobrado: 0,
        esta_pago: false,
        estado: "FINALIZADO",
        es_facturable: false,
        cliente_id: "cli-123",
        vehiculo_id: "veh-1",
      },
      {
        id: "arr-3", // Ya facturado
        precio_final: 150000,
        total_cobrado: 150000,
        esta_pago: true,
        estado: "FINALIZADO",
        es_facturable: true,
        cliente_id: "cli-123",
        vehiculo_id: "veh-1",
      },
      {
        id: "arr-4", // Presupuesto: NO debe contar para saldo a facturar ni para deuda
        precio_final: 70000,
        total_cobrado: 0,
        esta_pago: false,
        estado: "PRESUPUESTO",
        es_facturable: true,
        cliente_id: "cli-123",
        vehiculo_id: "veh-1",
      },
      {
        id: "arr-5", // Sobrepago: debe conservarse en el saldo neto consolidado
        precio_final: 100000,
        total_cobrado: 400000,
        esta_pago: true,
        estado: "FINALIZADO",
        es_facturable: false,
        cliente_id: "cli-123",
        vehiculo_id: "veh-1",
      },
    ];
    const mockFacturas = [{ arreglo_id: "arr-3" }];

    const mockNeq = vi.fn().mockImplementation(() => ({
      or: () => Promise.resolve({ data: mockArreglos, error: null }),
    }));

    const mockFrom = vi.fn((table: string) => {
      if (table === "vehiculos") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockVehiculos, error: null }),
          }),
        };
      }
      if (table === "arreglos") {
        return {
          select: () => ({
            neq: mockNeq,
          }),
        };
      }
      if (table === "facturas_electronicas") {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: mockFacturas, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const req = {} as NextRequest;
    const res = await GET(req, { params: Promise.resolve({ id: "cli-123" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockNeq).toHaveBeenCalledWith("estado", "PRESUPUESTO");
    // Deuda inicial de 250000 menos sobrepago de arr-5 (300000) => saldo a favor de 50000.
    expect(json.data.saldo_cuenta).toBe(-50000);
    // arr-1 pendiente factura: 200000. arr-2 no facturable (0). arr-3 ya facturado (0). arr-4 presupuesto (excluido) => saldo_a_facturar = 200000
    expect(json.data.saldo_a_facturar).toBe(200000);
    expect(json.data.total_historico_trabajos).toBe(550000);
    expect(json.data.total_historico_cobrado).toBe(600000);
    expect(json.data.cantidad_arreglos_pendientes_pago).toBe(2);
    expect(json.data.cantidad_arreglos_pendientes_factura).toBe(1);
  });
});
