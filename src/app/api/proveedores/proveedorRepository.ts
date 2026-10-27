import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, toServiceError } from "@/app/api/serviceError";
import type { OperacionLineaDTO, ProveedorCuentaCorrienteResumen, ProveedorOperacionItemDTO } from "@/model/dtos";

export type ProveedorRow = {
  id: string;
  tenant_id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  created_at: string;
  updated_at: string;
  saldo_pendiente?: number;
};

export type ProveedorSaldoInfo = {
  saldoPendiente: number;
  totalComprado: number;
  totalPagado: number;
};

export type ListProveedoresFilters = {
  search?: string;
  limit?: number;
};

export type CreateProveedorPayload = {
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
};

export type UpdateProveedorPayload = {
  nombre?: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export interface ProveedorRepository {
  list(
    supabase: SupabaseClient,
    filters?: ListProveedoresFilters
  ): Promise<{ data: ProveedorRow[]; error: ServiceError | null; cause?: PostgrestError }>;

  getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  create(
    supabase: SupabaseClient,
    payload: CreateProveedorPayload
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  updateById(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateProveedorPayload
  ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }>;

  deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }>;

  getCuentaCorriente(
    supabase: SupabaseClient,
    proveedorId: string
  ): Promise<{ data: ProveedorCuentaCorrienteResumen | null; error: ServiceError | PostgrestError | null }>;

  getSaldos(
    supabase: SupabaseClient,
    proveedorIds?: string[]
  ): Promise<{ data: Map<string, ProveedorSaldoInfo>; error: ServiceError | PostgrestError | null }>;
}

export const supabaseProveedorRepository: ProveedorRepository = {
  async list(supabase: SupabaseClient, filters?: ListProveedoresFilters) {
    let query = supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true });

    const search = filters?.search?.trim();
    if (search) {
      query = query.or(`nombre.ilike.%${search}%,cuit.ilike.%${search}%`);
    }

    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) return { data: [], ...serviceFailure(error) };
    return { data: (data ?? []) as ProveedorRow[], error: null };
  },

  async getById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as ProveedorRow, error: null };
  },

  async create(supabase: SupabaseClient, payload: CreateProveedorPayload) {
    const { data, error } = await supabase
      .from("proveedores")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return {
        data: null,
        error: toServiceError(error) === ServiceError.Conflict ? ServiceError.Conflict : error,
      };
    }
    return { data: (data ?? null) as ProveedorRow | null, error: null };
  },

  async updateById(supabase: SupabaseClient, id: string, payload: UpdateProveedorPayload) {
    const { data, error } = await supabase
      .from("proveedores")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: toServiceError(error) === ServiceError.Conflict ? ServiceError.Conflict : error,
      };
    }
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as ProveedorRow, error: null };
  },

  async deleteById(supabase: SupabaseClient, id: string) {
    const { error, count } = await supabase
      .from("proveedores")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) return { error };
    if (!count) return { error: ServiceError.NotFound };
    return { error: null };
  },

  async getCuentaCorriente(supabase: SupabaseClient, proveedorId: string) {
    const { data, error } = await supabase
      .from("operaciones_compra")
      .select("operaciones!inner(id, tipo, fecha, created_at, monto_total, total_pagado, estado_pago, estado_stock, observaciones, taller_id, talleres(nombre), operaciones_lineas(id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, created_at, stocks(producto_id, productos(nombre, codigo))))")
      .eq("proveedor_id", proveedorId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: toServiceError(error) ?? error };

    let totalComprado = 0;
    let totalPagado = 0;
    let saldoAdeudado = 0;

    const items: ProveedorOperacionItemDTO[] = Array.isArray(data)
      ? data.map((item: Record<string, unknown>) => {
          const row = (item.operaciones ?? item.operacion ?? item) as Record<string, unknown>;
          const montoTotal = Number(row.monto_total) || 0;
          const totalPagadoItem = Number(row.total_pagado) || 0;
          const saldoPendiente = Math.max(0, montoTotal - totalPagadoItem);

          totalComprado += montoTotal;
          totalPagado += totalPagadoItem;
          saldoAdeudado += saldoPendiente;

          const tallerObj = row.talleres && typeof row.talleres === "object"
            ? (row.talleres as Record<string, unknown>)
            : null;

          const rawLineas = row.operaciones_lineas;
          const lineas: OperacionLineaDTO[] = Array.isArray(rawLineas)
            ? rawLineas.map((l: Record<string, unknown>) => {
                const stockObj = l.stocks && typeof l.stocks === "object" ? (l.stocks as Record<string, unknown>) : null;
                const prodObj = stockObj?.productos && typeof stockObj.productos === "object" ? (stockObj.productos as Record<string, unknown>) : null;
                return {
                  id: String(l.id),
                  operacion_id: String(l.operacion_id ?? row.id),
                  stock_id: String(l.stock_id),
                  cantidad: Number(l.cantidad) || 0,
                  cantidad_cumplida: l.cantidad_cumplida !== undefined && l.cantidad_cumplida !== null ? Number(l.cantidad_cumplida) : undefined,
                  monto_unitario: Number(l.monto_unitario) || 0,
                  delta_cantidad: Number(l.delta_cantidad) || 0,
                  created_at: String(l.created_at ?? ""),
                  nombre: prodObj?.nombre ? String(prodObj.nombre) : (l.nombre ? String(l.nombre) : undefined),
                  codigo: prodObj?.codigo ? String(prodObj.codigo) : (l.codigo ? String(l.codigo) : undefined),
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
            saldo_pendiente: saldoPendiente,
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
        totalComprado,
        totalPagado,
        saldoAdeudado,
        operaciones: items,
      },
      error: null,
    };
  },

  async getSaldos(supabase: SupabaseClient, proveedorIds?: string[]) {
    let query = supabase
      .from("operaciones_compra")
      .select("proveedor_id, operaciones!inner(id, monto_total, total_pagado)");

    if (proveedorIds && proveedorIds.length > 0) {
      query = query.in("proveedor_id", proveedorIds);
    }

    const { data, error } = await query;
    if (error) return { data: new Map(), error: toServiceError(error) ?? error };

    const map = new Map<string, ProveedorSaldoInfo>();
    if (Array.isArray(data)) {
      for (const item of data as unknown[]) {
        const raw = item as Record<string, unknown>;
        const provId = String(raw.proveedor_id ?? "");
        const rawOp = raw.operaciones ?? raw.operacion ?? raw;
        const op = (Array.isArray(rawOp) ? rawOp[0] : rawOp) as Record<string, unknown> | undefined;
        const monto = Number(op?.monto_total) || 0;
        const pagado = Number(op?.total_pagado) || 0;
        const saldo = Math.max(0, monto - pagado);

        const current = map.get(provId) ?? {
          saldoPendiente: 0,
          totalComprado: 0,
          totalPagado: 0,
        };

        current.totalComprado += monto;
        current.totalPagado += pagado;
        current.saldoPendiente += saldo;

        map.set(provId, current);
      }

      for (const [, current] of map.entries()) {
        if (current.totalPagado > current.totalComprado) {
          current.saldoPendiente = current.totalComprado - current.totalPagado;
        }
      }
    }

    return { data: map, error: null };
  },
};
