export type DocumentoFiscalTipo = 80 | 86 | 96 | 99;

export type CondicionIvaReceptorId =
  | 1 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 13 | 15 | 16;

export type FacturacionAmbiente = "HOMOLOGACION" | "PRODUCCION";
export type CondicionIvaEmisor = "MONOTRIBUTISTA" | "RESPONSABLE_INSCRIPTO";
export type FacturaClase = "A" | "B" | "C" | "M";
export type FceSistemaCirculacion = "SCA" | "ADC";
export type DocumentoFiscalClase = "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
export type FacturaOrigenTipo = "ARREGLO" | "VENTA";
export type TratamientoIva = "GRAVADO" | "EXENTO" | "NO_GRAVADO";

export type FacturaElectronicaEstado =
  | "BORRADOR" | "LISTA" | "ENVIANDO" | "AUTORIZADA" | "RECHAZADA" | "INCIERTA";
export type FacturaConcepto = 1 | 2 | 3;
export type FacturaLineaOrigen = "SERVICIO" | "FORMULARIO" | "REPUESTO" | "VENTA" | "AJUSTE";

export type PerfilFiscalCliente = {
  clienteId: string | null;
  nombre: string;
  domicilio: string | null;
  tipoDocumento: DocumentoFiscalTipo | null;
  numeroDocumento: string | null;
  condicionIvaReceptorId: CondicionIvaReceptorId | null;
  /** Nombre y domicilio revisados al emitir: el PDF los conserva en lugar de consultar el padrón. */
  identidadRevisada?: true;
};

/** A quién se emite: el cliente del arreglo/venta o un receptor fiscal distinto. */
export type FacturaReceptorModo = "CLIENTE" | "OTRO";

/** Identidad registrada del cliente del origen; sólo contexto, no se modifica al facturar. */
export type FacturaClienteAsociado = {
  clienteId: string;
  nombre: string;
  documento: string | null;
};

/** Perfil fiscal sugerido del cliente del origen; se consulta aparte porque depende de ARCA. */
export type FacturaReceptorPrecarga = {
  receptor: PerfilFiscalCliente;
  clienteAsociado: FacturaClienteAsociado | null;
  advertenciaArcaReceptor?: string;
};

export const RECEPTOR_NOMBRE_MAX = 200;
export const RECEPTOR_DOMICILIO_MAX = 300;
export const DETALLE_SIMPLIFICADO_DESCRIPCION_DEFAULT = "Servicio de reparación y mantenimiento automotor";
export const DETALLE_SIMPLIFICADO_DESCRIPCION_MAX = 200;
export const NOMBRE_CONSUMIDOR_FINAL = "Consumidor final";

export type FacturaIssueGrupo = "RECEPTOR" | "COMPROBANTE" | "DETALLE" | "CONFIGURACION" | "EMISION";

/** Bloqueo o advertencia agrupable de un formulario de factura; `campo` identifica el input afectado. */
export type FacturaIssue = {
  codigo: string;
  grupo: FacturaIssueGrupo;
  campo?: string;
  mensaje: string;
  severidad: "error" | "advertencia";
};

export const FACTURA_ISSUE_GRUPO_LABEL: Record<FacturaIssueGrupo, string> = {
  RECEPTOR: "Receptor",
  COMPROBANTE: "Comprobante y fechas",
  DETALLE: "Detalle y origen",
  CONFIGURACION: "Configuración y FCE",
  EMISION: "Emisión",
};

export type FacturaRevisionLinea = Pick<FacturaLinea,
  "ordinal" | "origen" | "descripcion" | "codigo" | "cantidad" | "importeUnitario" | "subtotal"
  | "tratamientoIva" | "ivaAlicuota" | "importeNeto" | "importeIva" | "importeTotal"> & {
  /** Importe que muestra el comprobante para la línea. */
  importeMostrado: number;
};

/** Documento efectivo preparado por el servidor antes de emitir; no reserva número ni CAE. */
export type FacturaRevision = {
  revisionHash: string;
  origenTipo: FacturaOrigenTipo;
  origenId: string;
  ambiente: FacturacionAmbiente;
  clienteAsociado: FacturaClienteAsociado | null;
  receptorModo: FacturaReceptorModo;
  emisor: {
    razonSocial: string;
    nombreFantasia: string | null;
    cuit: string;
    domicilio: string;
    condicionIva: string;
    ingresosBrutos: string | null;
    inicioActividades: string;
    puntoVenta: number;
  };
  receptor: PerfilFiscalCliente;
  documentoTipo: DocumentoFiscalClase;
  claseComprobante: FacturaClase;
  tipoComprobante: number;
  concepto: FacturaConcepto;
  fce: { sistema: FceSistemaCirculacion | null; cbu: string | null } | null;
  condicionVenta: string;
  fechas: FacturaFechaInput;
  moneda: "PES";
  detalleSimplificado: boolean;
  lineas: FacturaRevisionLinea[];
  cantidadLineasOriginales: number;
  preciosIncluyenIva: boolean;
  totales: FacturaTotales;
  issues: FacturaIssue[];
};

export type FacturaLinea = {
  ordinal: number;
  origen: FacturaLineaOrigen;
  sourceId?: string | null;
  descripcion: string;
  codigo?: string | null;
  cantidad: number;
  importeUnitario: number;
  subtotal: number;
  tratamientoIva?: TratamientoIva;
  ivaAlicuotaId?: number | null;
  ivaAlicuota?: number;
  importeNeto?: number;
  importeIva?: number;
  importeTotal?: number;
  snapshot?: Record<string, unknown>;
};

export type FacturaTotales = {
  netoGravado: number;
  noGravado: number;
  exento: number;
  iva: number;
  tributos: number;
  otrosImpuestosNacionales: number;
  total: number;
};

export type FacturaFechaInput = {
  fechaComprobante: string;
  fechaServicioDesde?: string | null;
  fechaServicioHasta?: string | null;
  fechaVencimientoPago?: string | null;
};

export type FacturaElectronicaResumen = {
  id: string;
  estado: FacturaElectronicaEstado;
  ambiente: FacturacionAmbiente;
  origenTipo: FacturaOrigenTipo;
  origenId: string;
  documentoTipo: DocumentoFiscalClase;
  claseComprobante: FacturaClase;
  tipoComprobante: number;
  puntoVenta: number;
  numeroComprobante: number | null;
  cae: string | null;
  caeVencimiento: string | null;
  total: number;
  concepto: FacturaConcepto;
  fechaComprobante: string;
  receptorNombre: string;
  receptorDocumento: string | null;
  createdAt?: string;
  fceSistema?: FceSistemaCirculacion | null;
  fceCbu?: string | null;
  fechaVencimientoPago?: string | null;
  errorCodigo?: string | null;
  errorMensaje?: string | null;
};

export type FacturaElectronicaDetalle = FacturaElectronicaResumen & {
  emisorSnapshot: Record<string, unknown>;
  receptorSnapshot: Record<string, unknown>;
  fechas: FacturaFechaInput;
  condicionVenta: string;
  moneda: "PES";
  totales: FacturaTotales;
  lineas: FacturaLinea[];
  documentoAsociado: FacturaElectronicaResumen | null;
  documentosAjuste: FacturaElectronicaResumen[];
  intentos: Array<{
    id: string;
    numeroIntento: number;
    estado: string;
    errorCodigo: string | null;
    errorMensaje: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  origenExterno: boolean;
  pdfDisponible: boolean;
};

export type FacturaStockOrigen = {
  operacion_linea_id: string;
  operacion_origen_id: string;
  stock_id: string;
  taller_id: string;
  producto_id: string;
  origen_linea: "VENTA" | "REPUESTO";
  cantidad_original: number;
  nombre_snapshot: string;
  codigo_snapshot: string | null;
};

export type DevolucionStockDisponible = {
  operacionLineaId: string;
  nombre: string;
  codigo: string | null;
  origenLinea: "VENTA" | "REPUESTO";
  tallerId: string;
  cantidadOriginal: number;
  /** Kept for existing VENTA consumers; equals cantidadOriginal. */
  vendido: number;
  devuelto: number;
  reservado: number;
  restante: number;
};

export type DevolucionesDisponiblesResult = {
  origenTipo: FacturaOrigenTipo;
  procedenciaVerificada: boolean;
  advertencia: string | null;
  items: DevolucionStockDisponible[];
};

export type CondicionIngresosBrutos = "INSCRIPTO" | "EXENTO" | "NO_CONTRIBUYENTE";

export const CONDICIONES_INGRESOS_BRUTOS: Array<{ value: CondicionIngresosBrutos; label: string }> = [
  { value: "INSCRIPTO", label: "Inscripto" },
  { value: "EXENTO", label: "Exento" },
  { value: "NO_CONTRIBUYENTE", label: "No contribuyente" },
];

export type FacturacionConfiguracionPublica = {
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  condicionIvaEmisor: CondicionIvaEmisor;
  domicilio: string;
  ingresosBrutosCondicion: CondicionIngresosBrutos | null;
  /** Número de inscripción; sólo aplica a la condición Inscripto. */
  ingresosBrutos: string | null;
  inicioActividades: string;
  puntoVenta: number;
  fceCbu: string | null;
  fceSistema: FceSistemaCirculacion | null;
  ambiente: FacturacionAmbiente;
  credenciales: {
    configuradas: boolean;
    certificadoNombre: string | null;
    clavePrivadaNombre: string | null;
    fingerprintSha256: string | null;
    vencimiento: string | null;
    actualizadasAt: string | null;
  };
};

export type FacturacionPreflight = {
  /** Modo persistido; ausente en respuestas históricas implica incluido. */
  preciosIncluyenIva?: boolean;
  tasaIvaComercial?: number | null;
  puedeEmitir: boolean;
  configuracionCompleta: boolean;
  origenListo: boolean;
  diferenciasTotal: boolean;
  mensaje?: string;
  emisor?: Pick<FacturacionConfiguracionPublica,
    "razonSocial" | "cuit" | "puntoVenta" | "ambiente" | "condicionIvaEmisor">;
  receptor: PerfilFiscalCliente;
  /** Identidad registrada del cliente del origen; `receptor` puede venir del padrón. */
  clienteAsociado?: FacturaClienteAsociado | null;
  /** `receptor` todavía no es el perfil del cliente: se obtiene aparte con su precarga. */
  receptorPendiente?: boolean;
  /** Advertencia informativa cuando ARCA no pudo verificar el documento. */
  advertenciaArcaReceptor?: string;
  concepto: FacturaConcepto;
  documentoTipo: DocumentoFiscalClase;
  claseComprobante: FacturaClase;
  tipoComprobante: number;
  lineas: FacturaLinea[];
  totales: FacturaTotales;
  total: number;
  precioFinal: number;
  fechasDefault: FacturaFechaInput;
  fcePosible: boolean;
  fceObligatoria: boolean;
  fceSistemaConfigurado: FceSistemaCirculacion | null;
  fceCbuConfigurado: boolean;
  fceFechaConsulta: string;
  fceTotalConsultado: number;
};

export type FacturasPaginadas = {
  items: FacturaElectronicaResumen[];
  page: number;
  pageSize: number;
  total: number;
};

export const ALICUOTAS_IVA_ARCA = [
  { id: 3, label: "0%", porcentaje: 0 },
  { id: 9, label: "2,5%", porcentaje: 2.5 },
  { id: 8, label: "5%", porcentaje: 5 },
  { id: 4, label: "10,5%", porcentaje: 10.5 },
  { id: 5, label: "21%", porcentaje: 21 },
  { id: 6, label: "27%", porcentaje: 27 },
] as const;

export const CONDICIONES_IVA_RECEPTOR: Array<{ id: CondicionIvaReceptorId; label: string }> = [
  { id: 1, label: "Responsable inscripto" },
  { id: 4, label: "IVA exento" },
  { id: 5, label: "Consumidor final" },
  { id: 6, label: "Monotributista" },
  { id: 15, label: "IVA no alcanzado" },
];

export const TIPOS_DOCUMENTO_FISCAL: Array<{ id: DocumentoFiscalTipo; label: string }> = [
  { id: 99, label: "Consumidor final sin identificar" },
  { id: 96, label: "DNI" },
  { id: 86, label: "CUIL" },
  { id: 80, label: "CUIT" },
];

export const FACTURA_ESTADO_LABEL: Record<FacturaElectronicaEstado, string> = {
  BORRADOR: "Borrador", LISTA: "Lista", ENVIANDO: "Enviando",
  AUTORIZADA: "Autorizada", RECHAZADA: "Rechazada", INCIERTA: "Incierta",
};

export function comprobanteLabel(documento: DocumentoFiscalClase, clase: FacturaClase): string {
  const nombre = documento === "FACTURA"
    ? "Factura"
    : documento === "NOTA_CREDITO" ? "Nota de crédito" : "Nota de débito";
  return `${nombre} ${clase}`;
}
