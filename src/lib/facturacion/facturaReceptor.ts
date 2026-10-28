import { normalizeDocumentNumber } from "./arcaPayload";
import {
  DETALLE_SIMPLIFICADO_DESCRIPCION_MAX,
  RECEPTOR_DOMICILIO_MAX,
  RECEPTOR_NOMBRE_MAX,
  type FacturaIssue,
  type FacturaOrigenTipo,
} from "./types";

/**
 * Indica si el documento de la factura identifica al cliente registrado. La ficha
 * puede guardar el DNI y la factura el CUIL que ARCA asoció a ese DNI.
 */
export function documentoCorrespondeAlCliente(documentoFactura: string, documentoCliente: string): boolean {
  const invoiceDocument = normalizeDocumentNumber(documentoFactura);
  const clientDocument = normalizeDocumentNumber(documentoCliente);
  if (!invoiceDocument || !clientDocument) return false;
  if (invoiceDocument === clientDocument) return true;
  if (clientDocument.length === 11 && (invoiceDocument.length === 7 || invoiceDocument.length === 8)) {
    return clientDocument.slice(2, 10) === invoiceDocument.padStart(8, "0");
  }
  return invoiceDocument.length === 11
    && (clientDocument.length === 7 || clientDocument.length === 8)
    && invoiceDocument.slice(2, 10) === clientDocument.padStart(8, "0");
}

export function documentoNoCorrespondeMensaje(origenTipo: FacturaOrigenTipo): string {
  const cliente = origenTipo === "VENTA" ? "de la venta" : "del arreglo";
  return `El documento no corresponde al cliente ${cliente}. Para facturar a otra persona o empresa, elegí «Otro receptor / CUIT».`;
}

/** Nombre y domicilio que el comprobante imprime para un receptor identificado. */
export function receptorIdentidadIssues(input: { nombre: string; domicilio: string | null }): FacturaIssue[] {
  const issues: FacturaIssue[] = [];
  const nombre = input.nombre.trim();
  if (!nombre) {
    issues.push({
      codigo: "RECEPTOR_NOMBRE_REQUERIDO", grupo: "RECEPTOR", campo: "receptor.nombre",
      mensaje: "Ingresá el nombre o la razón social del receptor.", severidad: "error",
    });
  } else if (nombre.length > RECEPTOR_NOMBRE_MAX) {
    issues.push({
      codigo: "RECEPTOR_NOMBRE_EXTENSO", grupo: "RECEPTOR", campo: "receptor.nombre",
      mensaje: `El nombre o la razón social no puede superar los ${RECEPTOR_NOMBRE_MAX} caracteres.`, severidad: "error",
    });
  }
  if ((input.domicilio ?? "").trim().length > RECEPTOR_DOMICILIO_MAX) {
    issues.push({
      codigo: "RECEPTOR_DOMICILIO_EXTENSO", grupo: "RECEPTOR", campo: "receptor.domicilio",
      mensaje: `El domicilio no puede superar los ${RECEPTOR_DOMICILIO_MAX} caracteres.`, severidad: "error",
    });
  }
  return issues;
}

/** Texto de la única línea del detalle simplificado; no altera importes ni líneas fiscales. */
export function descripcionSimplificadaIssues(descripcion: string): FacturaIssue[] {
  const value = descripcion.trim();
  if (!value) {
    return [{
      codigo: "DETALLE_DESCRIPCION_REQUERIDA", grupo: "DETALLE", campo: "detalle.descripcion",
      mensaje: "Ingresá la descripción que aparecerá en la factura.", severidad: "error",
    }];
  }
  if (value.length > DETALLE_SIMPLIFICADO_DESCRIPCION_MAX) {
    return [{
      codigo: "DETALLE_DESCRIPCION_EXTENSA", grupo: "DETALLE", campo: "detalle.descripcion",
      mensaje: `La descripción no puede superar los ${DETALLE_SIMPLIFICADO_DESCRIPCION_MAX} caracteres.`, severidad: "error",
    }];
  }
  return [];
}
