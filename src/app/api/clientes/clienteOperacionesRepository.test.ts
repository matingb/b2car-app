import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseClienteOperacionesRepository } from "./clienteOperacionesRepository";

describe("clienteOperacionesRepository", () => {
  it("obtiene y mapea correctamente las operaciones de venta del cliente", async () => {
    const mockData = [
      {
        operaciones: {
          id: "op-1",
          tipo: "VENTA",
          fecha: "2026-10-25",
          created_at: "2026-10-25T10:00:00Z",
          monto_total: 5000,
          total_pagado: 3000,
          estado_pago: "PARCIAL",
          estado_stock: "ENTREGADO",
          observaciones: "Venta mostrador",
          taller_id: "t-1",
          talleres: { nombre: "Taller Central" },
          operaciones_lineas: [
            {
              id: "linea-1",
              operacion_id: "op-1",
              stock_id: "stk-1",
              cantidad: 2,
              cantidad_cumplida: 2,
              monto_unitario: 2500,
              delta_cantidad: -2,
              created_at: "2026-10-25T10:00:00Z",
              stocks: {
                producto_id: "prod-1",
                productos: {
                  nombre: "Filtro de Aceite",
                  codigo: "FLT-01",
                },
              },
            },
          ],
        },
      },
    ];

    const order = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const db = { from } as unknown as SupabaseClient;

    const res = await supabaseClienteOperacionesRepository.getOperaciones(db, "cli-1");

    expect(from).toHaveBeenCalledWith("operaciones_venta");
    expect(eq).toHaveBeenCalledWith("cliente_id", "cli-1");
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      totalVendido: 5000,
      totalCobrado: 3000,
      saldoPendiente: 2000,
      operaciones: [
        {
          id: "op-1",
          tipo: "VENTA",
          fecha: "2026-10-25",
          created_at: "2026-10-25T10:00:00Z",
          monto_total: 5000,
          total_pagado: 3000,
          saldo_pendiente: 2000,
          estado_pago: "PARCIAL",
          estado_stock: "ENTREGADO",
          observaciones: "Venta mostrador",
          taller_id: "t-1",
          taller_nombre: "Taller Central",
          lineas: [
            {
              id: "linea-1",
              operacion_id: "op-1",
              stock_id: "stk-1",
              cantidad: 2,
              cantidad_cumplida: 2,
              monto_unitario: 2500,
              delta_cantidad: -2,
              created_at: "2026-10-25T10:00:00Z",
              nombre: "Filtro de Aceite",
              codigo: "FLT-01",
            },
          ],
        },
      ],
    });
  });

  it("retorna error cuando la consulta a Supabase falla", async () => {
    const dbError = { code: "PGRST000", message: "Database connection failed" };
    const order = vi.fn().mockResolvedValue({ data: null, error: dbError });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const db = { from } as unknown as SupabaseClient;

    const res = await supabaseClienteOperacionesRepository.getOperaciones(db, "cli-1");

    expect(res.data).toBeNull();
    expect(res.error).toBeDefined();
  });
});
