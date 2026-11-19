import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import {
  isCondicionIvaProveedor,
  resumirComprobantes,
  sumarImportes,
  totalesLineas,
  type ComprobanteRecibido,
  type ComprobanteRecibidoIdentidad,
  type ComprobanteRecibidoInput,
  type ComprobanteRecibidoLinea,
  type ComprobanteRecibidoPrecarga,
  type ComprobanteRecibidoResumen,
  type ComprobantesOperacion,
  type FacturaRecibidaClase,
  type OperacionDocumentableTipo,
  type PercepcionCodigo,
} from "@/lib/comprobantesRecibidos/types";
import {
  supabaseComprobanteRecibidoRepository,
  type ComprobanteRecibidoRepository,
  type ComprobanteRecibidoRow,
  type GuardarComprobanteParams,
  type OperacionDocumentableRow,
} from "./comprobanteRecibidoRepository";

/*
 * Reglas de negocio de comprobantes recibidos.
 *
 * Invariancia documental: este servicio solo lee operaciones y escribe documentos/lineas por RPC.
 * No registra, anula ni recalcula pagos, saldos, estado de pago, cuentas ni stock. Las diferencias
 * entre documentos y monto operativo se informan y nunca se ajustan.
 */

export type ComprobanteServiceResult<T> = {
  data: T | null;
  error: ServiceError | null;
  /** Error original de la base, para que la ruta exponga mensajes de negocio de la RPC. */
  cause?: PostgrestError | null;
  message?: string;
};

const OPERACION_NO_ENCONTRADA = "Operación no encontrada";
const DOCUMENTO_NO_ENCONTRADO = "Documento no encontrado";
const OPERACION_NO_DOCUMENTABLE = "Solo se pueden asociar facturas y retenciones a compras o gastos";

function failure<T>(err: PostgrestError): ComprobanteServiceResult<T> {
  return { data: null, error: toServiceError(err), cause: err };
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function operacionTipo(value: unknown): OperacionDocumentableTipo | null {
  return value === "COMPRA" || value === "GASTO" ? value : null;
}

function proveedorDeOperacion(row: OperacionDocumentableRow): string | null {
  const compra = Array.isArray(row.operaciones_compra) ? row.operaciones_compra[0] : row.operaciones_compra;
  return compra?.proveedor_id ?? null;
}

function mapLineas(row: ComprobanteRecibidoRow): ComprobanteRecibidoLinea[] {
  return [...(row.comprobantes_recibidos_lineas ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((linea) => ({
      id: linea.id,
      tipo: linea.tipo === "PERCEPCION" ? "PERCEPCION" : "CONCEPTO",
      descripcion: linea.descripcion,
      percepcionCodigo: linea.tipo === "PERCEPCION" ? ((linea.percepcion_codigo ?? "OTRA") as PercepcionCodigo) : null,
      importe: asNumber(linea.importe),
      ivaAlicuotaId: linea.iva_alicuota_id ?? null,
    }));
}

export function mapComprobanteRecibido(row: ComprobanteRecibidoRow): ComprobanteRecibido {
  const lineas = mapLineas(row);
  const totales = totalesLineas(lineas);
  return {
    id: row.id,
    operacionId: row.operacion_id,
    operacionTipo: operacionTipo(row.operaciones?.tipo),
    tipoDocumento: row.tipo_documento === "RETENCION" ? "RETENCION" : "FACTURA",
    clase: (row.clase as FacturaRecibidaClase | null) ?? null,
    numero: row.numero,
    fecha: row.fecha,
    proveedorId: row.proveedor_id,
    emisor: {
      razonSocial: row.emisor_razon_social,
      cuit: row.emisor_cuit,
      condicionIva: isCondicionIvaProveedor(row.emisor_condicion_iva) ? row.emisor_condicion_iva : null,
      domicilio: row.emisor_domicilio,
    },
    receptor: {
      razonSocial: row.receptor_razon_social,
      cuit: row.receptor_cuit,
      condicionIva: isCondicionIvaProveedor(row.receptor_condicion_iva) ? row.receptor_condicion_iva : null,
    },
    codigoAutorizacion: row.codigo_autorizacion,
    vencimientoAutorizacion: row.vencimiento_autorizacion,
    fechaVencimiento: row.fecha_vencimiento ?? null,
    observaciones: row.observaciones,
    lineas,
    desgloseIva: row.desglose_iva?.map((item) => ({ ivaAlicuotaId: item.iva_alicuota_id, base: asNumber(item.base), iva: asNumber(item.iva) })) ?? null,
    ...totales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Resumen para el listado unificado de Documentos (requiere las líneas para el total). */
export function mapComprobanteRecibidoResumen(row: ComprobanteRecibidoRow): ComprobanteRecibidoResumen {
  return {
    id: row.id,
    operacionId: row.operacion_id,
    operacionTipo: operacionTipo(row.operaciones?.tipo),
    tipoDocumento: row.tipo_documento === "RETENCION" ? "RETENCION" : "FACTURA",
    clase: (row.clase as FacturaRecibidaClase | null) ?? null,
    numero: row.numero,
    fecha: row.fecha,
    emisorRazonSocial: row.emisor_razon_social,
    emisorCuit: row.emisor_cuit,
    total: sumarImportes((row.comprobantes_recibidos_lineas ?? []).map((linea) => asNumber(linea.importe))),
    createdAt: row.created_at,
  };
}

function toRpcParams(
  operacionId: string,
  input: ComprobanteRecibidoInput,
  comprobanteId: string | null,
  idempotencyKey: string | null,
): GuardarComprobanteParams {
  return {
    p_comprobante_id: comprobanteId,
    p_operacion_id: operacionId,
    p_idempotency_key: idempotencyKey,
    p_datos: {
      tipo_documento: input.tipoDocumento,
      clase: input.tipoDocumento === "FACTURA" ? input.clase : null,
      numero: input.numero,
      fecha: input.fecha,
      proveedor_id: input.proveedorId,
      emisor_razon_social: input.emisor.razonSocial,
      emisor_cuit: input.emisor.cuit,
      emisor_condicion_iva: input.emisor.condicionIva,
      emisor_domicilio: input.emisor.domicilio,
      receptor_razon_social: input.receptor.razonSocial,
      receptor_cuit: input.receptor.cuit,
      receptor_condicion_iva: input.receptor.condicionIva,
      codigo_autorizacion: input.codigoAutorizacion,
      vencimiento_autorizacion: input.vencimientoAutorizacion,
      fecha_vencimiento: input.fechaVencimiento,
      observaciones: input.observaciones,
      desglose_iva: input.desgloseIva?.map((item) => ({ iva_alicuota_id: item.ivaAlicuotaId, base: item.base, iva: item.iva })) ?? null,
    },
    p_lineas: input.lineas.map((linea) => ({
      tipo: linea.tipo,
      descripcion: linea.descripcion,
      percepcion_codigo: linea.tipo === "PERCEPCION" ? linea.percepcionCodigo ?? "OTRA" : null,
      importe: linea.importe,
      iva_alicuota_id: linea.ivaAlicuotaId ?? null,
    })),
  };
}

const EMPTY_IDENTIDAD: ComprobanteRecibidoIdentidad = { razonSocial: null, cuit: null, condicionIva: null };

export function createComprobanteRecibidoService(
  repository: ComprobanteRecibidoRepository = supabaseComprobanteRecibidoRepository,
) {
  async function precarga(
    supabase: SupabaseClient,
    tenantId: string,
    proveedorId: string | null,
    ambiente: string,
  ): Promise<ComprobanteRecibidoPrecarga> {
    const result: ComprobanteRecibidoPrecarga = {
      proveedorId,
      emisor: { ...EMPTY_IDENTIDAD, domicilio: null },
      receptor: { ...EMPTY_IDENTIDAD },
    };
    // La precarga es una ayuda: si no hay ficha o configuración, el formulario queda editable y vacío.
    const [proveedor, receptor] = await Promise.all([
      proveedorId ? repository.getProveedorFiscal(supabase, tenantId, proveedorId) : Promise.resolve(null),
      repository.getReceptorFiscal(supabase, tenantId, ambiente),
    ]);
    if (proveedor?.error) logger.warn("[comprobantesRecibidos.precarga] No se pudo leer la ficha del proveedor", proveedor.error);
    if (proveedor?.data) {
      result.emisor = {
        razonSocial: proveedor.data.nombre,
        cuit: proveedor.data.cuit,
        condicionIva: isCondicionIvaProveedor(proveedor.data.condicion_iva) ? proveedor.data.condicion_iva : null,
        domicilio: proveedor.data.direccion,
      };
    }
    if (receptor.error) logger.warn("[comprobantesRecibidos.precarga] No se pudo leer la configuración fiscal del tenant", receptor.error);
    if (receptor.data) {
      result.receptor = {
        razonSocial: receptor.data.razon_social,
        cuit: receptor.data.cuit,
        condicionIva: isCondicionIvaProveedor(receptor.data.condicion_iva_emisor) ? receptor.data.condicion_iva_emisor : null,
      };
    }
    return result;
  }

  return {
    async listByOperacion(
      supabase: SupabaseClient,
      tenantId: string,
      operacionId: string,
      ambiente: string,
    ): Promise<ComprobanteServiceResult<ComprobantesOperacion>> {
      const operacion = await repository.getOperacion(supabase, tenantId, operacionId);
      if (operacion.error) return failure(operacion.error);
      if (!operacion.data) return { data: null, error: ServiceError.NotFound, message: OPERACION_NO_ENCONTRADA };
      const tipo = operacionTipo(operacion.data.tipo);
      if (!tipo) return { data: null, error: ServiceError.Validation, message: OPERACION_NO_DOCUMENTABLE };

      const rows = await repository.listByOperacion(supabase, tenantId, operacionId);
      if (rows.error) return failure(rows.error);

      const comprobantes = (rows.data ?? []).map(mapComprobanteRecibido);
      const montoTotal = asNumber(operacion.data.monto_total);
      const proveedorId = proveedorDeOperacion(operacion.data);
      return {
        data: {
          operacion: { id: operacion.data.id, tipo, montoTotal, proveedorId },
          comprobantes,
          resumen: resumirComprobantes(comprobantes, montoTotal),
          precarga: await precarga(supabase, tenantId, proveedorId, ambiente),
        },
        error: null,
      };
    },

    async getById(
      supabase: SupabaseClient,
      tenantId: string,
      id: string,
    ): Promise<ComprobanteServiceResult<ComprobanteRecibido>> {
      const { data, error } = await repository.getById(supabase, tenantId, id);
      if (error) return failure(error);
      if (!data) return { data: null, error: ServiceError.NotFound, message: DOCUMENTO_NO_ENCONTRADO };
      return { data: mapComprobanteRecibido(data), error: null };
    },

    /** Alta asociada a una operación existente. Un reintento con la misma clave devuelve el mismo documento. */
    async create(
      supabase: SupabaseClient,
      tenantId: string,
      operacionId: string,
      input: ComprobanteRecibidoInput,
      idempotencyKey: string,
    ): Promise<ComprobanteServiceResult<ComprobanteRecibido>> {
      const saved = await repository.guardar(supabase, toRpcParams(operacionId, input, null, idempotencyKey));
      if (saved.error) return failure(saved.error);
      if (!saved.data) return { data: null, error: ServiceError.Unknown };
      return this.getById(supabase, tenantId, saved.data);
    },

    /** Edición explícita: reemplaza cabecera y líneas, conserva la operación y no toca la ficha del proveedor. */
    async update(
      supabase: SupabaseClient,
      tenantId: string,
      id: string,
      input: ComprobanteRecibidoInput,
    ): Promise<ComprobanteServiceResult<ComprobanteRecibido>> {
      const current = await repository.getById(supabase, tenantId, id);
      if (current.error) return failure(current.error);
      if (!current.data) return { data: null, error: ServiceError.NotFound, message: DOCUMENTO_NO_ENCONTRADO };
      if (current.data.tipo_documento !== input.tipoDocumento) {
        return { data: null, error: ServiceError.Validation, message: "No se puede cambiar el tipo de un documento registrado" };
      }
      const saved = await repository.guardar(supabase, toRpcParams(current.data.operacion_id, input, id, null));
      if (saved.error) return failure(saved.error);
      return this.getById(supabase, tenantId, id);
    },

    /** Elimina solo el documento: la operación, sus pagos y su stock quedan intactos. */
    async remove(supabase: SupabaseClient, id: string): Promise<ComprobanteServiceResult<true>> {
      const { error } = await repository.eliminar(supabase, id);
      if (error) return failure(error);
      return { data: true, error: null };
    },
  };
}

export const comprobanteRecibidoService = createComprobanteRecibidoService();
