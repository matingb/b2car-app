import {
  determineVoucher,
  FacturacionValidationError,
  validateDocument,
  validateFechas,
  validateReceiverIdentification,
} from "@/lib/facturacion/arcaPayload";
import {
  descripcionSimplificadaIssues,
  documentoCorrespondeAlCliente,
  documentoNoCorrespondeMensaje,
  receptorIdentidadIssues,
} from "@/lib/facturacion/facturaReceptor";
import type {
  CondicionIvaEmisor,
  CondicionIvaReceptorId,
  DocumentoFiscalTipo,
  FacturaClienteAsociado,
  FacturaConcepto,
  FacturaFechaInput,
  FacturaIssue,
  FacturaIssueGrupo,
  FacturaOrigenTipo,
} from "@/lib/facturacion/types";
import type { ReceptorDraft } from "./facturaReceptorDraft";

/** Id del input que corresponde a cada `campo` de un mensaje de validación. */
export const FACTURA_CAMPO_INPUT_ID: Record<string, string> = {
  "receptor.tipoDocumento": "factura-tipo-documento",
  "receptor.numeroDocumento": "factura-numero-documento",
  "receptor.nombre": "factura-receptor-nombre",
  "receptor.domicilio": "factura-receptor-domicilio",
  "receptor.condicionIva": "factura-condicion-iva",
  condicionVenta: "factura-condicion-venta",
  "fechas.fechaComprobante": "factura-fecha-comprobante",
  "fechas.fechaServicioDesde": "factura-fecha-servicio-desde",
  "fechas.fechaServicioHasta": "factura-fecha-servicio-hasta",
  "fechas.fechaVencimientoPago": "factura-fecha-vencimiento-pago",
  "detalle.descripcion": "factura-detalle-descripcion",
};

export type FacturaFormValidationInput = {
  origenTipo: FacturaOrigenTipo;
  receptor: ReceptorDraft;
  clienteAsociado: FacturaClienteAsociado | null;
  condicionIvaEmisor: CondicionIvaEmisor | null;
  concepto: FacturaConcepto;
  fechas: FacturaFechaInput;
  fce: boolean;
  detalleSimplificado: boolean;
  descripcionDetalleSimplificado: string;
};

function issue(codigo: string, grupo: FacturaIssueGrupo, campo: string, mensaje: string): FacturaIssue {
  return { codigo, grupo, campo, mensaje, severidad: "error" };
}

function captureIssue(run: () => unknown, codigo: string, grupo: FacturaIssueGrupo, campo: string): FacturaIssue | null {
  try {
    run();
    return null;
  } catch (error) {
    if (!(error instanceof FacturacionValidationError)) throw error;
    return issue(codigo, grupo, error.campo ?? campo, error.message);
  }
}

/**
 * Validaciones del formulario antes de pedir la revisión. Son las mismas reglas
 * que aplica el servidor, que sigue decidiendo el comprobante y sus importes.
 */
export function validateFacturaForm(input: FacturaFormValidationInput): FacturaIssue[] {
  const issues: FacturaIssue[] = [];
  const push = (value: FacturaIssue | null) => { if (value) issues.push(value); };
  const { receptor } = input;
  const tipoDocumento = Number(receptor.tipoDocumento) as DocumentoFiscalTipo;
  const condicion = receptor.condicionIvaReceptorId
    ? Number(receptor.condicionIvaReceptorId) as CondicionIvaReceptorId
    : null;

  const documentIssue = captureIssue(
    () => validateDocument(tipoDocumento, receptor.numeroDocumento),
    "RECEPTOR_DOCUMENTO_INVALIDO", "RECEPTOR", "receptor.numeroDocumento",
  );
  push(documentIssue);
  if (!documentIssue && receptor.modo === "CLIENTE" && tipoDocumento !== 99 && input.clienteAsociado?.documento
    && !documentoCorrespondeAlCliente(receptor.numeroDocumento, input.clienteAsociado.documento)) {
    issues.push(issue("DOCUMENTO_NO_CORRESPONDE_AL_CLIENTE", "RECEPTOR", "receptor.numeroDocumento", documentoNoCorrespondeMensaje(input.origenTipo)));
  }
  if (tipoDocumento !== 99) {
    issues.push(...receptorIdentidadIssues({ nombre: receptor.nombre, domicilio: receptor.domicilio }));
  }
  if (!condicion) {
    issues.push(issue("RECEPTOR_CONDICION_IVA_REQUERIDA", "RECEPTOR", "receptor.condicionIva", "Seleccioná la condición frente al IVA del receptor."));
  } else if (!documentIssue && input.condicionIvaEmisor) {
    const clase = determineVoucher(input.condicionIvaEmisor, condicion).clase;
    push(captureIssue(
      () => validateReceiverIdentification({ tipoDocumento, numeroDocumento: receptor.numeroDocumento, condicionIvaReceptorId: condicion }, clase),
      "RECEPTOR_IDENTIFICACION_INVALIDA", "RECEPTOR", "receptor.tipoDocumento",
    ));
  }

  const required: Array<[keyof FacturaFechaInput, boolean, string]> = [
    ["fechaComprobante", true, "Ingresá la fecha del comprobante."],
    ["fechaServicioDesde", input.concepto !== 1, "Ingresá el inicio del período de servicios."],
    ["fechaServicioHasta", input.concepto !== 1, "Ingresá el fin del período de servicios."],
    ["fechaVencimientoPago", input.concepto !== 1 || input.fce, "Ingresá el vencimiento de pago."],
  ];
  const missing = required.filter(([field, applies]) => applies && !input.fechas[field]);
  missing.forEach(([field, , mensaje]) => issues.push(issue("FECHA_REQUERIDA", "COMPROBANTE", `fechas.${field}`, mensaje)));
  if (!missing.length) {
    push(captureIssue(
      () => validateFechas(input.concepto, input.fechas, new Date(), input.fce),
      "FECHAS_INVALIDAS", "COMPROBANTE", "fechas.fechaComprobante",
    ));
  }

  if (input.origenTipo === "ARREGLO" && input.detalleSimplificado) {
    issues.push(...descripcionSimplificadaIssues(input.descripcionDetalleSimplificado));
  }
  return issues;
}
