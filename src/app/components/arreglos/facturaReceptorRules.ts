import { receiverDocumentTypesForCondition } from "@/lib/facturacion/arcaPayload";
import type {
  DocumentoFiscalTipo,
  PerfilFiscalCliente,
} from "@/lib/facturacion/types";

const RESPONSABLE_INSCRIPTO = 1;

export function documentTypesForInvoiceCondition(
  condicionIvaReceptorId: PerfilFiscalCliente["condicionIvaReceptorId"],
): DocumentoFiscalTipo[] {
  if (condicionIvaReceptorId === RESPONSABLE_INSCRIPTO) {
    return [96, 86, 80];
  }
  if (condicionIvaReceptorId === null) return [80];
  return receiverDocumentTypesForCondition(condicionIvaReceptorId);
}

export function responsableInscriptoNeedsCuit(
  condicionIvaReceptorId: PerfilFiscalCliente["condicionIvaReceptorId"],
  tipoDocumento: string,
): boolean {
  return condicionIvaReceptorId === RESPONSABLE_INSCRIPTO && tipoDocumento !== "80";
}
