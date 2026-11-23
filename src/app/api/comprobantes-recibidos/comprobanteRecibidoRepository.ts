import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { CreateTurnoInput } from "@/app/api/turnos/turnosService";

/*
 * Acceso a datos de comprobantes recibidos. La lectura respeta RLS (tenant + permiso de consulta);
 * las escrituras pasan solo por las RPC SECURITY DEFINER, que validan permiso de gestión, tenant,
 * operación COMPRA/GASTO, duplicados e idempotencia en una transacción.
 */

export const COMPROBANTE_RECIBIDO_COLUMNS = [
  "id",
  "tenant_id",
  "operacion_id",
  "tipo_documento",
  "clase",
  "numero",
  "fecha",
  "proveedor_id",
  "emisor_razon_social",
  "emisor_cuit",
  "emisor_condicion_iva",
  "emisor_domicilio",
  "receptor_razon_social",
  "receptor_cuit",
  "receptor_condicion_iva",
  "codigo_autorizacion",
  "vencimiento_autorizacion",
  "fecha_vencimiento",
  "observaciones",
  "desglose_iva",
  "iva_contenido",
  "created_at",
  "updated_at",
  "operaciones(tipo, taller_id)",
  "comprobantes_recibidos_lineas(id, orden, tipo, descripcion, percepcion_codigo, importe, iva_alicuota_id)",
].join(", ");

export type ComprobanteRecibidoLineaRow = {
  id: string;
  orden: number;
  tipo: string;
  descripcion: string;
  percepcion_codigo: string | null;
  importe: number | string;
  iva_alicuota_id: number | null;
};

export type ComprobanteRecibidoRow = {
  id: string;
  tenant_id: string;
  operacion_id: string;
  tipo_documento: string;
  clase: string | null;
  numero: string | null;
  fecha: string;
  proveedor_id: string | null;
  emisor_razon_social: string;
  emisor_cuit: string | null;
  emisor_condicion_iva: string | null;
  emisor_domicilio: string | null;
  receptor_razon_social: string | null;
  receptor_cuit: string | null;
  receptor_condicion_iva: string | null;
  codigo_autorizacion: string | null;
  vencimiento_autorizacion: string | null;
  fecha_vencimiento: string | null;
  observaciones: string | null;
  desglose_iva: Array<{ iva_alicuota_id: number; base: number; iva: number }> | null;
  iva_contenido: number | string | null;
  created_at: string;
  updated_at: string;
  operaciones?: { tipo: string | null; taller_id: string | null } | null;
  comprobantes_recibidos_lineas?: ComprobanteRecibidoLineaRow[] | null;
};

export type OperacionDocumentableRow = {
  id: string;
  tipo: string;
  monto_total: number | string | null;
  operaciones_compra?: { proveedor_id: string | null } | { proveedor_id: string | null }[] | null;
};

export type ProveedorFiscalRow = {
  id: string;
  nombre: string;
  cuit: string | null;
  direccion: string | null;
  condicion_iva: string | null;
};

export type ReceptorFiscalRow = {
  razon_social: string | null;
  cuit: string | null;
  condicion_iva_emisor: string | null;
};

/** Parámetros de rpc_comprobante_recibido_guardar_con_iva (claves snake_case dentro de p_datos/p_lineas). */
export type GuardarComprobanteParams = {
  p_comprobante_id: string | null;
  p_operacion_id: string;
  p_datos: Record<string, unknown>;
  p_lineas: Array<Record<string, unknown>>;
  p_idempotency_key: string | null;
};

type Result<T> = { data: T | null; error: PostgrestError | null };

export interface ComprobanteRecibidoRepository {
  getOperacion(supabase: SupabaseClient, tenantId: string, operacionId: string): Promise<Result<OperacionDocumentableRow>>;
  listByOperacion(supabase: SupabaseClient, tenantId: string, operacionId: string): Promise<Result<ComprobanteRecibidoRow[]>>;
  getById(supabase: SupabaseClient, tenantId: string, id: string): Promise<Result<ComprobanteRecibidoRow>>;
  getProveedorFiscal(supabase: SupabaseClient, tenantId: string, proveedorId: string): Promise<Result<ProveedorFiscalRow>>;
  getReceptorFiscal(supabase: SupabaseClient, tenantId: string, ambiente: string): Promise<Result<ReceptorFiscalRow>>;
  guardar(supabase: SupabaseClient, params: GuardarComprobanteParams): Promise<Result<string>>;
  eliminar(supabase: SupabaseClient, id: string): Promise<Result<boolean>>;
  guardarTurnoVencimiento(
    supabase: SupabaseClient, tenantId: string, comprobanteId: string, turno: CreateTurnoInput,
  ): Promise<{ error: PostgrestError | null }>;
}

export const supabaseComprobanteRecibidoRepository: ComprobanteRecibidoRepository = {
  async getOperacion(supabase, tenantId, operacionId) {
    const { data, error } = await supabase
      .from("operaciones")
      .select("id, tipo, monto_total, operaciones_compra(proveedor_id)")
      .eq("tenant_id", tenantId)
      .eq("id", operacionId)
      .maybeSingle();
    return { data: (data as OperacionDocumentableRow | null) ?? null, error };
  },

  async listByOperacion(supabase, tenantId, operacionId) {
    const { data, error } = await supabase
      .from("comprobantes_recibidos")
      .select(COMPROBANTE_RECIBIDO_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("operacion_id", operacionId)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true });
    return { data: (data as unknown as ComprobanteRecibidoRow[] | null) ?? [], error };
  },

  async getById(supabase, tenantId, id) {
    const { data, error } = await supabase
      .from("comprobantes_recibidos")
      .select(COMPROBANTE_RECIBIDO_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    return { data: (data as unknown as ComprobanteRecibidoRow | null) ?? null, error };
  },

  async guardarTurnoVencimiento(supabase, tenantId, comprobanteId, turno) {
    const { error } = await supabase.from("turnos").upsert(
      { ...turno, tenant_id: tenantId, comprobante_recibido_id: comprobanteId },
      { onConflict: "comprobante_recibido_id,tenant_id", ignoreDuplicates: true },
    );
    return { error };
  },

  async getProveedorFiscal(supabase, tenantId, proveedorId) {
    const { data, error } = await supabase
      .from("proveedores")
      .select("id, nombre, cuit, direccion, condicion_iva")
      .eq("tenant_id", tenantId)
      .eq("id", proveedorId)
      .maybeSingle();
    return { data: (data as ProveedorFiscalRow | null) ?? null, error };
  },

  async getReceptorFiscal(supabase, tenantId, ambiente) {
    const { data, error } = await supabase
      .from("facturacion_configuracion_ambiente")
      .select("razon_social, cuit, condicion_iva_emisor")
      .eq("tenant_id", tenantId)
      .eq("ambiente", ambiente)
      .maybeSingle();
    return { data: (data as ReceptorFiscalRow | null) ?? null, error };
  },

  async guardar(supabase, params) {
    const { data, error } = await supabase.rpc("rpc_comprobante_recibido_guardar_con_iva", params);
    return { data: typeof data === "string" ? data : null, error };
  },

  async eliminar(supabase, id) {
    const { data, error } = await supabase.rpc("rpc_comprobante_recibido_eliminar", { p_comprobante_id: id });
    return { data: data === true, error };
  },
};
