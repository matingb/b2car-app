import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ClienteOperacionesResumen, ClienteOperacionItemDTO, OperacionLineaDTO } from "@/model/dtos";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export interface ClienteOperacionesRepository {
  getOperaciones(
    supabase: SupabaseClient,
    clienteId: string
  ): Promise<{ data: ClienteOperacionesResumen | null; error: ServiceError | PostgrestError | null }>;
}

export const supabaseClienteOperacionesRepository: ClienteOperacionesRepository = {
  async getOperaciones(supabase: SupabaseClient, clienteId: string) {
    const { data, error } = await supabase
      .from("operaciones_venta")
      .select(
        "operaciones!inner(id, tipo, fecha, created_at, monto_total, total_pagado, estado_pago, estado_stock, observaciones, taller_id, talleres(nombre), operaciones_lineas(id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, created_at, stocks(producto_id, productos(nombre, codigo))))"
      )
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: toServiceError(error) ?? error };

    let totalVendido = 0;
    let totalCobrado = 0;
    let saldoPendiente = 0;

    const items: ClienteOperacionItemDTO[] = Array.isArray(data)
      ? data.map((item: Record<string, unknown>) => {
          const row = (item.operaciones ?? item.operacion ?? item) as Record<string, unknown>;
          const montoTotal = Number(row.monto_total) || 0;
          const totalPagadoItem = Number(row.total_pagado) || 0;
          const saldoPendienteItem = Math.max(0, montoTotal - totalPagadoItem);

          totalVendido += montoTotal;
          totalCobrado += totalPagadoItem;
          saldoPendiente += saldoPendienteItem;

          const tallerObj =
            row.talleres && typeof row.talleres === "object"
              ? (row.talleres as Record<string, unknown>)
              : null;

          const rawLineas = row.operaciones_lineas;
          const lineas: OperacionLineaDTO[] = Array.isArray(rawLineas)
            ? rawLineas.map((l: Record<string, unknown>) => {
                const stockObj =
                  l.stocks && typeof l.stocks === "object"
                    ? (l.stocks as Record<string, unknown>)
                    : null;
                const prodObj =
                  stockObj?.productos && typeof stockObj.productos === "object"
                    ? (stockObj.productos as Record<string, unknown>)
                    : null;
                return {
                  id: String(l.id),
                  operacion_id: String(l.operacion_id ?? row.id),
                  stock_id: String(l.stock_id),
                  cantidad: Number(l.cantidad) || 0,
                  cantidad_cumplida:
                    l.cantidad_cumplida !== undefined && l.cantidad_cumplida !== null
                      ? Number(l.cantidad_cumplida)
                      : undefined,
                  monto_unitario: Number(l.monto_unitario) || 0,
                  delta_cantidad: Number(l.delta_cantidad) || 0,
                  created_at: String(l.created_at ?? ""),
                  nombre: prodObj?.nombre
                    ? String(prodObj.nombre)
                    : l.nombre
                    ? String(l.nombre)
                    : undefined,
                  codigo: prodObj?.codigo
                    ? String(prodObj.codigo)
                    : l.codigo
                    ? String(l.codigo)
                    : undefined,
                };
              })
            : [];

          return {
            id: String(row.id),
            tipo: String(row.tipo),
            fecha: String(row.fecha),
            created_at: String(row.created_at),
            monto_total: montoTotal,
            total_pagado: totalPagadoItem,
            saldo_pendiente: saldoPendienteItem,
            estado_pago: String(row.estado_pago ?? "PAGADO"),
            estado_stock: String(row.estado_stock ?? "ENTREGADO"),
            observaciones: row.observaciones ? String(row.observaciones) : null,
            taller_id: row.taller_id ? String(row.taller_id) : null,
            taller_nombre: tallerObj?.nombre ? String(tallerObj.nombre) : null,
            lineas,
          };
        })
      : [];

    return {
      data: {
        totalVendido,
        totalCobrado,
        saldoPendiente,
        operaciones: items,
      },
      error: null,
    };
  },
};
