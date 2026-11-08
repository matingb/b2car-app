import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, toServiceError } from "@/app/api/serviceError";
import type { OperacionLineaDTO, ProveedorCuentaCorrienteResumen, ProveedorOperacionItemDTO } from "@/model/dtos";
import type { SentidoMovimientoCuentaCorriente } from "@/model/types";

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

export type CreatePagoDirectoProveedorPayload = {
  proveedor_id: string;
  sentido?: SentidoMovimientoCuentaCorriente;
  cuenta_id?: string | null;
  monto?: number | null;
  fecha?: string;
  descripcion?: string | null;
  idempotency_key?: string | null;
  observaciones?: string | null;
  taller_id?: string | null;
  pagos?: Array<{
    cuenta_id: string;
    monto: number;
    fecha?: string;
    descripcion?: string;
    idempotency_key?: string;
  }>;
};

export type ProveedorExtractoFilters = {
  from?: string | null;
  to?: string | null;
};

export type ProveedorMovimientoCuentaCorrienteRow = {
  id: unknown;
  fecha: unknown;
  created_at?: unknown;
  tipo_movimiento: unknown;
  concepto?: unknown;
  comprobante?: unknown;
  debito?: unknown;
  credito?: unknown;
  operacion_id?: unknown;
  cuenta_nombre?: unknown;
};

type RpcProveedorSaldoRow = {
  proveedor_id: string;
  total_comprado: number | string;
  total_pagado: number | string;
  saldo: number | string;
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

  getExtractoCuentaCorriente?(
    supabase: SupabaseClient,
    proveedorId: string,
    filters?: ProveedorExtractoFilters
  ): Promise<{ data: ProveedorMovimientoCuentaCorrienteRow[] | null; error: ServiceError | PostgrestError | null }>;

  getSaldos(
    supabase: SupabaseClient,
    proveedorIds?: string[]
  ): Promise<{ data: Map<string, ProveedorSaldoInfo>; error: ServiceError | PostgrestError | null }>;

  createPagoDirecto(
    supabase: SupabaseClient,
    payload: CreatePagoDirectoProveedorPayload
  ): Promise<{ data: string | null; error: ServiceError | PostgrestError | null }>;
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
    const [comprasRes, saldosRes] = await Promise.all([
      supabase
        .from("operaciones_compra")
        .select("operaciones!inner(id, tipo, fecha, created_at, monto_total, total_pagado, estado_pago, estado_stock, observaciones, taller_id, talleres(nombre), operaciones_lineas(id, operacion_id, stock_id, cantidad, cantidad_cumplida, monto_unitario, delta_cantidad, created_at, stocks(producto_id, productos(nombre, codigo))))")
        .eq("proveedor_id", proveedorId)
        .order("created_at", { ascending: false }),
      typeof supabase.rpc === "function"
        ? supabase.rpc("rpc_proveedores_saldos", { p_proveedor_ids: [proveedorId] })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (comprasRes.error) return { data: null, error: toServiceError(comprasRes.error) ?? comprasRes.error };
    if (saldosRes.error) return { data: null, error: toServiceError(saldosRes.error) ?? saldosRes.error };

    let fallbackComprado = 0;
    let fallbackPagado = 0;

    const items: ProveedorOperacionItemDTO[] = [];

    if (Array.isArray(comprasRes.data)) {
      for (const item of comprasRes.data as unknown[]) {
        const raw = item as Record<string, unknown>;
        const row = (raw.operaciones ?? raw.operacion ?? raw) as Record<string, unknown>;
        const montoTotal = Number(row.monto_total) || 0;
        const totalPagadoItem = Number(row.total_pagado) || 0;
        const saldoPendiente = Math.max(0, montoTotal - totalPagadoItem);

        fallbackComprado += montoTotal;
        fallbackPagado += totalPagadoItem;

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

        items.push({
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
        });
      }
    }

    items.sort((a, b) => {
      const timeA = new Date(a.fecha || a.created_at).getTime();
      const timeB = new Date(b.fecha || b.created_at).getTime();
      return timeB - timeA;
    });

    const saldoRows = Array.isArray(saldosRes.data) ? (saldosRes.data as RpcProveedorSaldoRow[]) : null;
    const saldoRow = saldoRows?.find((r) => String(r.proveedor_id) === proveedorId) ?? saldoRows?.[0];

    const totalComprado = saldoRow ? Number(saldoRow.total_comprado) || 0 : fallbackComprado;
    const totalPagado = saldoRow ? Number(saldoRow.total_pagado) || 0 : fallbackPagado;
    const saldoAdeudado = saldoRow ? Number(saldoRow.saldo) || 0 : fallbackComprado - fallbackPagado;

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

  async getExtractoCuentaCorriente(
    supabase: SupabaseClient,
    proveedorId: string,
    filters?: ProveedorExtractoFilters
  ) {
    const { data, error } = await supabase.rpc("rpc_proveedor_cuenta_corriente", {
      p_proveedor_id: proveedorId,
      p_from: filters?.from ?? null,
      p_to: filters?.to ?? null,
    });

    if (error) return { data: null, error: toServiceError(error) ?? error };
    return {
      data: (data as ProveedorMovimientoCuentaCorrienteRow[] | null) ?? [],
      error: null,
    };
  },

  async getSaldos(supabase: SupabaseClient, proveedorIds?: string[]) {
    const { data, error } = await supabase.rpc("rpc_proveedores_saldos", {
      p_proveedor_ids: proveedorIds && proveedorIds.length > 0 ? proveedorIds : null,
    });

    if (error) return { data: new Map(), error: toServiceError(error) ?? error };

    const map = new Map<string, ProveedorSaldoInfo>();
    if (Array.isArray(data)) {
      for (const item of data as RpcProveedorSaldoRow[]) {
        const provId = String(item.proveedor_id ?? "");
        if (!provId) continue;
        map.set(provId, {
          totalComprado: Number(item.total_comprado) || 0,
          totalPagado: Number(item.total_pagado) || 0,
          saldoPendiente: Number(item.saldo) || 0,
        });
      }
    }

    return { data: map, error: null };
  },

  async createPagoDirecto(
    supabase: SupabaseClient,
    payload: CreatePagoDirectoProveedorPayload
  ) {
    const rpcName =
      payload.sentido === "COBRO"
        ? "rpc_crear_cobro_proveedor"
        : "rpc_crear_pago_proveedor";

    const { data, error } = await supabase.rpc(rpcName, {
      p_proveedor_id: payload.proveedor_id,
      p_cuenta_id: payload.cuenta_id ?? null,
      p_monto: payload.monto ?? null,
      p_fecha: payload.fecha ?? new Date().toISOString(),
      p_descripcion: payload.descripcion ?? null,
      p_idempotency_key: payload.idempotency_key ?? null,
      p_observaciones: payload.observaciones ?? null,
      p_taller_id: payload.taller_id ?? null,
      p_pagos: payload.pagos && payload.pagos.length > 0 ? payload.pagos : null,
    });

    if (error) return { data: null, error: toServiceError(error) ?? error };
    return { data: typeof data === "string" ? data : String(data ?? ""), error: null };
  },
};
