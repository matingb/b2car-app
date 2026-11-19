/*
 * Comprobantes recibidos: facturas A/B/C y retenciones documentales de compras y gastos.
 *
 * Son registros informativos asociados a exactamente una operación COMPRA/GASTO. Crear, editar o
 * eliminar uno no modifica pagos, saldos, estado de pago, cuentas ni stock. En facturas A los precios
 * de conceptos son netos y se suma IVA por alícuota; en facturas B y C se conserva el importe final.
 * El IVA contenido informado en una factura B se guarda separado y nunca se usa como IVA discriminado.
 */

export type ComprobanteRecibidoTipo = "FACTURA" | "RETENCION";
export type FacturaRecibidaClase = "A" | "B" | "C";
export type ComprobanteRecibidoLineaTipo = "CONCEPTO" | "PERCEPCION";
export type PercepcionCodigo = "GANANCIAS" | "IVA" | "IIBB_BUENOS_AIRES" | "IIBB_CABA" | "OTRA";
export type OperacionDocumentableTipo = "COMPRA" | "GASTO";

/** Posición de IVA de un proveedor/emisor (y del receptor cuando se informa). */
export type CondicionIvaProveedor =
  | "RESPONSABLE_INSCRIPTO"
  | "MONOTRIBUTISTA"
  | "IVA_EXENTO"
  | "IVA_NO_ALCANZADO";

export const CONDICIONES_IVA_PROVEEDOR: ReadonlyArray<{ value: CondicionIvaProveedor; label: string }> = [
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable inscripto" },
  { value: "MONOTRIBUTISTA", label: "Monotributista" },
  { value: "IVA_EXENTO", label: "IVA exento" },
  { value: "IVA_NO_ALCANZADO", label: "IVA no alcanzado" },
];

export const COMPROBANTE_RECIBIDO_TIPO_LABEL: Record<ComprobanteRecibidoTipo, string> = {
  FACTURA: "Factura",
  RETENCION: "Retención",
};

export const FACTURA_RECIBIDA_CLASES: readonly FacturaRecibidaClase[] = ["A", "B", "C"];

/** Accesos rápidos del selector abierto de percepciones. No es un catálogo cerrado. */
export const PERCEPCIONES_SUGERIDAS: ReadonlyArray<{ codigo: Exclude<PercepcionCodigo, "OTRA">; label: string }> = [
  { codigo: "GANANCIAS", label: "Ganancias" },
  { codigo: "IVA", label: "IVA" },
  { codigo: "IIBB_BUENOS_AIRES", label: "IIBB Buenos Aires" },
  { codigo: "IIBB_CABA", label: "IIBB CABA" },
];

export const MAX_LINEAS_COMPROBANTE = 100;

export type ComprobanteRecibidoLinea = {
  id?: string;
  tipo: ComprobanteRecibidoLineaTipo;
  descripcion: string;
  /** Solo en percepciones: código sugerido u OTRA para percepciones libres. */
  percepcionCodigo: PercepcionCodigo | null;
  importe: number;
  ivaAlicuotaId?: number | null;
};

export type DesgloseIvaRecibido = { ivaAlicuotaId: number; base: number; iva: number };

export type ComprobanteRecibidoIdentidad = {
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: CondicionIvaProveedor | null;
};

export type ComprobanteRecibidoEmisor = ComprobanteRecibidoIdentidad & {
  domicilio: string | null;
};

export type ComprobanteRecibido = {
  id: string;
  operacionId: string;
  operacionTipo: OperacionDocumentableTipo | null;
  tipoDocumento: ComprobanteRecibidoTipo;
  clase: FacturaRecibidaClase | null;
  numero: string | null;
  fecha: string;
  proveedorId: string | null;
  emisor: ComprobanteRecibidoEmisor;
  receptor: ComprobanteRecibidoIdentidad;
  codigoAutorizacion: string | null;
  vencimientoAutorizacion: string | null;
  /** Fecha de vencimiento de la factura informada por el proveedor. */
  fechaVencimiento: string | null;
  observaciones: string | null;
  lineas: ComprobanteRecibidoLinea[];
  desgloseIva?: DesgloseIvaRecibido[] | null;
  /** IVA contenido informado manualmente en una factura B; no es un desglose fiscal discriminado. */
  ivaContenido?: number | null;
  totalConceptos: number;
  totalPercepciones: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

/** Ítem liviano para el listado unificado de Documentos. */
export type ComprobanteRecibidoResumen = {
  id: string;
  operacionId: string;
  operacionTipo: OperacionDocumentableTipo | null;
  tipoDocumento: ComprobanteRecibidoTipo;
  clase: FacturaRecibidaClase | null;
  numero: string | null;
  fecha: string;
  emisorRazonSocial: string;
  emisorCuit: string | null;
  total: number;
  createdAt: string;
};

/** Datos editables del formulario. La operación se indica por ruta, no en el cuerpo. */
export type ComprobanteRecibidoInput = {
  tipoDocumento: ComprobanteRecibidoTipo;
  clase: FacturaRecibidaClase | null;
  numero: string | null;
  fecha: string;
  proveedorId: string | null;
  emisor: ComprobanteRecibidoEmisor;
  receptor: ComprobanteRecibidoIdentidad;
  codigoAutorizacion: string | null;
  vencimientoAutorizacion: string | null;
  fechaVencimiento: string | null;
  observaciones: string | null;
  lineas: ComprobanteRecibidoLinea[];
  desgloseIva?: DesgloseIvaRecibido[] | null;
  /** Importe informativo, solo para factura B. No se infiere desde conceptos ni tasas. */
  ivaContenido?: number | null;
};

/** Comparación informativa con el monto operativo. Nunca bloquea ni ajusta importes. */
export type ComprobantesOperacionResumen = {
  montoOperacion: number;
  cantidadFacturas: number;
  totalFacturas: number;
  /** totalFacturas - montoOperacion. Las retenciones no se suman a este total. */
  diferenciaFacturas: number;
  cantidadRetenciones: number;
  totalRetenciones: number;
};

/** Datos fiscales precargables: copia editable que no actualiza la ficha del proveedor. */
export type ComprobanteRecibidoPrecarga = {
  proveedorId: string | null;
  emisor: ComprobanteRecibidoEmisor;
  receptor: ComprobanteRecibidoIdentidad;
};

export type ComprobantesOperacion = {
  operacion: {
    id: string;
    tipo: OperacionDocumentableTipo;
    montoTotal: number;
    proveedorId: string | null;
  };
  comprobantes: ComprobanteRecibido[];
  resumen: ComprobantesOperacionResumen;
  precarga: ComprobanteRecibidoPrecarga;
};

export function isCondicionIvaProveedor(value: unknown): value is CondicionIvaProveedor {
  return CONDICIONES_IVA_PROVEEDOR.some((condicion) => condicion.value === value);
}

export function condicionIvaLabel(value: string | null | undefined): string {
  return CONDICIONES_IVA_PROVEEDOR.find((condicion) => condicion.value === value)?.label ?? "Sin informar";
}

export function percepcionLabel(codigo: PercepcionCodigo | null, descripcion: string): string {
  return PERCEPCIONES_SUGERIDAS.find((sugerida) => sugerida.codigo === codigo)?.label ?? descripcion;
}

function normalizarTexto(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

/**
 * Resuelve el valor del selector abierto de percepciones. Una sugerencia conserva su código estable;
 * un texto libre igual a una sugerencia (sin distinguir espacios ni mayúsculas) usa esa sugerencia;
 * cualquier otro texto queda como percepción libre (OTRA) con su descripción visible.
 */
export function resolverPercepcion(value: string): { codigo: PercepcionCodigo; descripcion: string } | null {
  const texto = value.trim().replace(/\s+/g, " ");
  if (!texto) return null;
  const sugerida = PERCEPCIONES_SUGERIDAS.find(
    (opcion) => opcion.codigo === texto || normalizarTexto(opcion.label) === normalizarTexto(texto),
  );
  if (sugerida) return { codigo: sugerida.codigo, descripcion: sugerida.label };
  return { codigo: "OTRA", descripcion: texto };
}

/** Importe a centavos enteros para sumar sin errores de coma flotante. */
export function toCents(value: number): number {
  return Math.round((Number(value) || 0) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumarImportes(values: readonly number[]): number {
  return fromCents(values.reduce((acc, value) => acc + toCents(value), 0));
}

export function totalesLineas(lineas: readonly Pick<ComprobanteRecibidoLinea, "tipo" | "importe">[]) {
  const totalConceptos = sumarImportes(lineas.filter((linea) => linea.tipo === "CONCEPTO").map((linea) => linea.importe));
  const totalPercepciones = sumarImportes(lineas.filter((linea) => linea.tipo === "PERCEPCION").map((linea) => linea.importe));
  return { totalConceptos, totalPercepciones, total: sumarImportes([totalConceptos, totalPercepciones]) };
}

/** Diferencia informativa (documento - operación) en pesos, redondeada a centavos. */
export function diferenciaImportes(documento: number, operacion: number): number {
  return fromCents(toCents(documento) - toCents(operacion));
}

export function resumirComprobantes(
  comprobantes: readonly Pick<ComprobanteRecibido, "tipoDocumento" | "total">[],
  montoOperacion: number,
): ComprobantesOperacionResumen {
  const facturas = comprobantes.filter((comprobante) => comprobante.tipoDocumento === "FACTURA");
  const retenciones = comprobantes.filter((comprobante) => comprobante.tipoDocumento === "RETENCION");
  const totalFacturas = sumarImportes(facturas.map((factura) => factura.total));
  return {
    montoOperacion,
    cantidadFacturas: facturas.length,
    totalFacturas,
    diferenciaFacturas: diferenciaImportes(totalFacturas, montoOperacion),
    cantidadRetenciones: retenciones.length,
    totalRetenciones: sumarImportes(retenciones.map((retencion) => retencion.total)),
  };
}

/** Solo dígitos, como la normalización de la base para detectar duplicados. */
export function normalizarCuit(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCuit(value: string | null | undefined): string {
  const digits = normalizarCuit(value);
  if (digits.length !== 11) return value?.trim() || "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function comprobanteRecibidoTitulo(
  comprobante: Pick<ComprobanteRecibido, "tipoDocumento" | "clase" | "numero">,
): string {
  if (comprobante.tipoDocumento === "FACTURA") {
    return `Factura ${comprobante.clase ?? ""}${comprobante.numero ? ` ${comprobante.numero}` : ""}`.trim();
  }
  return comprobante.numero ? `Retención ${comprobante.numero}` : "Retención";
}
