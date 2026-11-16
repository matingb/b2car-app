import { parseCalendarDate } from "@/lib/fechas";
import { isValidUuid } from "@/lib/uuid";
import {
  FACTURA_RECIBIDA_CLASES,
  MAX_LINEAS_COMPROBANTE,
  isCondicionIvaProveedor,
  normalizarCuit,
  type ComprobanteRecibidoInput,
  type ComprobanteRecibidoLinea,
  type FacturaRecibidaClase,
  type PercepcionCodigo,
} from "./types";

/*
 * Validación local del formulario y de la API. La base vuelve a validar en la RPC, y es la única
 * fuente de la regla de duplicados. "Sin borradores" significa que no se guarda nada con datos
 * requeridos ausentes: no hay estado intermedio.
 */

export type ComprobanteInputResult = { value?: ComprobanteRecibidoInput; error?: string };

const CODIGOS_PERCEPCION: readonly PercepcionCodigo[] = ["GANANCIAS", "IVA", "IIBB_BUENOS_AIRES", "IIBB_CABA", "OTRA"];
const MAX_IMPORTE = 999_999_999_999.99;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, max: number, field: string): { value: string | null; error?: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { value: null, error: `${field} no es válido` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { value: null, error: `${field} no puede superar los ${max} caracteres` };
  return { value: trimmed || null };
}

function importe(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_IMPORTE) return null;
  if (Math.round(parsed * 100) / 100 !== parsed) return null;
  return parsed;
}

function parseLineas(raw: unknown, tipoDocumento: ComprobanteRecibidoInput["tipoDocumento"]): { value?: ComprobanteRecibidoLinea[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Cargá al menos una línea con descripción e importe" };
  if (raw.length > MAX_LINEAS_COMPROBANTE) return { error: `El documento admite hasta ${MAX_LINEAS_COMPROBANTE} líneas` };
  const lineas: ComprobanteRecibidoLinea[] = [];
  for (const [index, item] of raw.entries()) {
    const n = index + 1;
    const source = record(item);
    if (!source) return { error: `Línea ${n}: formato inválido` };
    const tipo = source.tipo;
    if (tipo !== "CONCEPTO" && tipo !== "PERCEPCION") return { error: `Línea ${n}: el tipo debe ser concepto o percepción` };
    if (tipoDocumento === "RETENCION" && tipo !== "CONCEPTO") {
      return { error: `Línea ${n}: las retenciones solo admiten líneas de concepto` };
    }
    const descripcion = text(source.descripcion, 200, `Línea ${n}: la descripción`);
    if (descripcion.error) return { error: descripcion.error };
    if (!descripcion.value) return { error: `Línea ${n}: la descripción es obligatoria` };
    const monto = importe(source.importe);
    if (monto === null) return { error: `Línea ${n}: el importe debe ser mayor a 0 y tener hasta 2 decimales` };
    let percepcionCodigo: PercepcionCodigo | null = null;
    if (tipo === "PERCEPCION") {
      const codigo = source.percepcionCodigo ?? "OTRA";
      if (!CODIGOS_PERCEPCION.includes(codigo as PercepcionCodigo)) return { error: `Línea ${n}: la percepción no es válida` };
      percepcionCodigo = codigo as PercepcionCodigo;
    }
    lineas.push({ tipo, descripcion: descripcion.value, percepcionCodigo, importe: monto });
  }
  return { value: lineas };
}

function cuit(value: string | null, field: string): string | undefined {
  if (value && normalizarCuit(value).length !== 11) return `${field} debe tener 11 dígitos`;
  return undefined;
}

export function parseComprobanteRecibidoInput(raw: unknown): ComprobanteInputResult {
  const body = record(raw);
  if (!body) return { error: "Los datos del documento son obligatorios" };

  const tipoDocumento = body.tipoDocumento;
  if (tipoDocumento !== "FACTURA" && tipoDocumento !== "RETENCION") {
    return { error: "El tipo de documento debe ser factura o retención" };
  }

  const fecha = typeof body.fecha === "string" ? body.fecha.trim() : "";
  if (!fecha) return { error: "La fecha del documento es obligatoria" };
  if (!parseCalendarDate(fecha)) return { error: "La fecha del documento debe tener formato AAAA-MM-DD" };

  const vencimientoRaw = typeof body.vencimientoAutorizacion === "string" ? body.vencimientoAutorizacion.trim() : "";
  if (vencimientoRaw && !parseCalendarDate(vencimientoRaw)) {
    return { error: "El vencimiento de la autorización debe tener formato AAAA-MM-DD" };
  }

  const fechaVencimientoRaw = typeof body.fechaVencimiento === "string" ? body.fechaVencimiento.trim() : "";
  if (fechaVencimientoRaw && !parseCalendarDate(fechaVencimientoRaw)) {
    return { error: "La fecha de vencimiento debe tener formato AAAA-MM-DD" };
  }
  if (fechaVencimientoRaw && fechaVencimientoRaw < fecha) {
    return { error: "La fecha de vencimiento no puede ser anterior a la fecha de la factura" };
  }

  const proveedorId = body.proveedorId === undefined || body.proveedorId === null || body.proveedorId === ""
    ? null
    : body.proveedorId;
  if (proveedorId !== null && !isValidUuid(proveedorId)) return { error: "El proveedor no es válido" };

  const emisorRaw = record(body.emisor) ?? {};
  const receptorRaw = record(body.receptor) ?? {};
  const fields = {
    numero: text(body.numero, 50, "El número"),
    emisorRazonSocial: text(emisorRaw.razonSocial, 200, "La razón social del emisor"),
    emisorCuit: text(emisorRaw.cuit, 20, "El CUIT del emisor"),
    emisorDomicilio: text(emisorRaw.domicilio, 300, "El domicilio del emisor"),
    receptorRazonSocial: text(receptorRaw.razonSocial, 200, "La razón social del receptor"),
    receptorCuit: text(receptorRaw.cuit, 20, "El CUIT del receptor"),
    codigoAutorizacion: text(body.codigoAutorizacion, 50, "El código de autorización"),
    observaciones: text(body.observaciones, 1000, "Las observaciones"),
  };
  const fieldError = Object.values(fields).find((field) => field.error)?.error;
  if (fieldError) return { error: fieldError };

  const emisorCondicion = emisorRaw.condicionIva ?? null;
  if (emisorCondicion !== null && emisorCondicion !== "" && !isCondicionIvaProveedor(emisorCondicion)) {
    return { error: "La posición de IVA del proveedor no es válida" };
  }
  const receptorCondicion = receptorRaw.condicionIva ?? null;
  if (receptorCondicion !== null && receptorCondicion !== "" && !isCondicionIvaProveedor(receptorCondicion)) {
    return { error: "La posición de IVA del receptor no es válida" };
  }

  if (!fields.emisorRazonSocial.value) return { error: "La razón social del emisor es obligatoria" };
  const cuitError = cuit(fields.emisorCuit.value, "El CUIT del emisor") ?? cuit(fields.receptorCuit.value, "El CUIT del receptor");
  if (cuitError) return { error: cuitError };

  let clase: FacturaRecibidaClase | null = null;
  if (tipoDocumento === "FACTURA") {
    if (!FACTURA_RECIBIDA_CLASES.includes(body.clase as FacturaRecibidaClase)) {
      return { error: "La clase de la factura debe ser A, B o C" };
    }
    clase = body.clase as FacturaRecibidaClase;
    if (!fields.numero.value || !/[0-9A-Za-z]/.test(fields.numero.value)) return { error: "El número de factura es obligatorio" };
    if (!emisorCondicion) return { error: "La posición de IVA del proveedor es obligatoria" };
    if (!fields.emisorCuit.value) return { error: "El CUIT del emisor es obligatorio" };
  }

  const lineas = parseLineas(body.lineas, tipoDocumento);
  if (lineas.error || !lineas.value) return { error: lineas.error ?? "Las líneas no son válidas" };

  return {
    value: {
      tipoDocumento,
      clase,
      numero: fields.numero.value,
      fecha,
      proveedorId: proveedorId as string | null,
      emisor: {
        razonSocial: fields.emisorRazonSocial.value,
        cuit: fields.emisorCuit.value,
        condicionIva: isCondicionIvaProveedor(emisorCondicion) ? emisorCondicion : null,
        domicilio: fields.emisorDomicilio.value,
      },
      receptor: {
        razonSocial: fields.receptorRazonSocial.value,
        cuit: fields.receptorCuit.value,
        condicionIva: isCondicionIvaProveedor(receptorCondicion) ? receptorCondicion : null,
      },
      codigoAutorizacion: fields.codigoAutorizacion.value,
      vencimientoAutorizacion: vencimientoRaw || null,
      fechaVencimiento: fechaVencimientoRaw || null,
      observaciones: fields.observaciones.value,
      lineas: lineas.value,
    },
  };
}
