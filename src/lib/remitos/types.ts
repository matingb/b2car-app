import { formatNumberAr } from "@/lib/format";
import type {
  CondicionIvaEmisor,
  CondicionIvaReceptorId,
  FacturaLineaOrigen,
  FacturacionAmbiente,
} from "@/lib/facturacion/types";

/**
 * Un remito documenta traslados o entregas de bienes: no es un comprobante fiscal,
 * no se informa a ARCA y ninguno de estos tipos expone importes.
 */
export type RemitoClase = "R" | "X";

/** Documento del destinatario: CUIT, CUIL o DNI. Sin documento se representa con `null`. */
export type RemitoDocumentoTipo = 80 | 86 | 96;

export type RemitoDestinatario = {
  clienteId: string | null;
  nombre: string;
  domicilio: string | null;
  tipoDocumento: RemitoDocumentoTipo | null;
  numeroDocumento: string | null;
  condicionIvaReceptorId: CondicionIvaReceptorId | null;
  /** Etiqueta guardada en el snapshot al emitir. */
  condicionIva?: string | null;
};

export type RemitoTransportista = {
  nombre: string;
  domicilio: string | null;
  cuit: string | null;
};

export type RemitoEmisor = {
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  domicilio: string;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  condicionIvaEmisor: CondicionIvaEmisor;
  condicionIva: string;
};

export type RemitoImpresion = {
  autoimpresor: boolean;
  numeroDesde: number | null;
  numeroHasta: number | null;
  /** Inicio de actividades del establecimiento; si falta se usa el del emisor. */
  inicioActividades: string | null;
  imprenta: {
    razonSocial: string;
    cuit: string;
    fechaImpresion: string | null;
    habilitacion: string;
  } | null;
};

export type RemitoLinea = {
  id: string;
  ordinal: number;
  codigo: string | null;
  descripcion: string;
  observaciones: string | null;
  cantidad: number;
  facturaLineaId: string | null;
};

/** Referencia a la factura asociada. No incluye el total ni ningún importe de la factura. */
export type RemitoFacturaRef = {
  id: string;
  label: string;
  fechaComprobante: string | null;
  receptorNombre: string | null;
  receptorDocumento: string | null;
};

export type RemitoResumen = {
  id: string;
  clase: RemitoClase;
  puntoEmision: number;
  numero: number;
  numeroVisible: string;
  fechaEmision: string;
  ambiente: FacturacionAmbiente;
  destinatarioNombre: string;
  destinatarioDocumento: string | null;
  arregloId: string | null;
  factura: { id: string; label: string } | null;
};

export type RemitoDetalle = Omit<RemitoResumen, "factura"> & {
  tipoComprobante: number | null;
  emisor: RemitoEmisor;
  destinatario: RemitoDestinatario;
  transportista: RemitoTransportista | null;
  cai: string | null;
  caiVencimiento: string | null;
  impresion: RemitoImpresion | null;
  observaciones: string | null;
  lineas: RemitoLinea[];
  factura: RemitoFacturaRef | null;
  facturaAsociadaAt: string | null;
  createdAt: string;
};

export type RemitosPaginados = {
  items: RemitoResumen[];
  page: number;
  pageSize: number;
  total: number;
};

export type RemitosFiltros = {
  page?: number;
  pageSize?: number;
  clase?: string | null;
  factura?: string | null;
  desde?: string | null;
  hasta?: string | null;
  search?: string | null;
};

export type RemitoRConfiguracion = {
  cai: string | null;
  caiVencimiento: string | null;
  puntoEmision: number | null;
  numeroDesde: number | null;
  numeroHasta: number | null;
  proximoNumero: number;
  inicioActividades: string | null;
  /** Campos conservados por compatibilidad de API; la configuración vigente siempre usa autoimpresión. */
  autoimpresor: boolean;
  imprenta: {
    razonSocial: string | null;
    cuit: string | null;
    fechaImpresion: string | null;
    habilitacion: string | null;
  };
};

export type RemitoXConfiguracion = {
  puntoEmision: number;
  proximoNumero: number;
};

export type RemitosConfiguracionInput = {
  remitoR: RemitoRConfiguracion;
  remitoX: RemitoXConfiguracion;
};

export type RemitosConfiguracion = RemitosConfiguracionInput & {
  ambiente: FacturacionAmbiente;
  /** Último número emitido por clase para el punto de emisión configurado. */
  ultimoEmitido: Record<RemitoClase, string | null>;
  updatedAt: string | null;
};

export type EvaluacionTipo = {
  emitible: boolean;
  motivos: string[];
};

export type EvaluacionEmisor = {
  completo: boolean;
  faltantes: string[];
};

/** Línea facturada vista desde el remito: solo cantidades, nunca precios. */
export type RemitoFacturaLineaDisponible = {
  id: string;
  ordinal: number;
  origen: FacturaLineaOrigen;
  codigo: string | null;
  descripcion: string;
  cantidadFacturada: number;
  cantidadRemitida: number;
  cantidadDisponible: number;
};

/** Bien precargado desde un arreglo. Solo contiene descripción, código y cantidad. */
export type RemitoArregloLinea = {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
};

export type RemitoArregloOrigen = {
  id: string;
  label: string;
  destinatario: RemitoDestinatario;
  lineas: RemitoArregloLinea[];
};

export type RemitoPreflight = {
  ambiente: FacturacionAmbiente;
  emisor: EvaluacionEmisor;
  tipos: Record<RemitoClase, EvaluacionTipo & { proximoNumeroVisible: string | null }>;
  factura: {
    id: string;
    label: string;
    fechaComprobante: string | null;
    destinatario: RemitoDestinatario;
    lineas: RemitoFacturaLineaDisponible[];
  } | null;
  arreglo: RemitoArregloOrigen | null;
};

export type FacturaRemitos = {
  remitos: RemitoResumen[];
  lineas: RemitoFacturaLineaDisponible[];
};

export type EmitirRemitoLineaInput = {
  facturaLineaId: string | null;
  codigo: string | null;
  descripcion: string;
  observaciones: string | null;
  cantidad: number;
};

export type EmitirRemitoInput = {
  idempotencyKey: string;
  clase: RemitoClase;
  arregloId: string | null;
  facturaId: string | null;
  destinatario: Omit<RemitoDestinatario, "condicionIva">;
  transportista: RemitoTransportista | null;
  observaciones: string | null;
  lineas: EmitirRemitoLineaInput[];
};

export type AsociarFacturaInput = {
  facturaId: string;
  lineas: Array<{ remitoLineaId: string; facturaLineaId: string }>;
};

export const REMITO_LEYENDA = "DOCUMENTO NO VÁLIDO COMO FACTURA";
export const REMITO_R_TIPO_COMPROBANTE = 91;
export const REMITO_MAX_LINEAS = 200;
export const REMITO_NUMERO_MAXIMO = 99_999_999;
export const REMITO_PUNTO_EMISION_MAXIMO = 99_999;

export const REMITO_TIPO_INFO: Record<RemitoClase, { titulo: string; descripcion: string }> = {
  R: {
    titulo: "Remito R",
    descripcion: "Régimen general de traslado/entrega. Requiere CAI vigente.",
  },
  X: {
    titulo: "Remito X",
    descripcion: "Previsto para traslados dentro de un mismo predio, polo o parque industrial.",
  },
};

export const REMITO_SUGERENCIA_NORMATIVA =
  "Sugerencia normativa (no obligatoria): según RG 1415/2003 el Remito R corresponde al régimen general; "
  + "el Remito X, a traslados dentro de un mismo predio. La elección es tuya y B2Car no la modifica.";

export const REMITO_DOCUMENTO_TIPOS: Array<{ id: RemitoDocumentoTipo; label: string }> = [
  { id: 80, label: "CUIT" },
  { id: 86, label: "CUIL" },
  { id: 96, label: "DNI" },
];

/** Formato visible del número: `R 00001-00000008`. */
export function formatRemitoNumero(clase: RemitoClase, puntoEmision: number, numero: number): string {
  return `${clase} ${String(puntoEmision).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;
}

/** Documento del destinatario para mostrar: `DNI 30111222`, `CUIT 20123456786` o `null`. */
export function formatRemitoDocumento(
  destinatario: Pick<RemitoDestinatario, "tipoDocumento" | "numeroDocumento">,
): string | null {
  if (!destinatario.tipoDocumento || !destinatario.numeroDocumento) return null;
  const label = REMITO_DOCUMENTO_TIPOS.find((tipo) => tipo.id === destinatario.tipoDocumento)?.label ?? "Documento";
  return `${label} ${destinatario.numeroDocumento}`;
}

/** Cantidad con separadores AR y hasta 4 decimales, sin ceros de relleno: `1,5`, `1.250`. */
export function formatRemitoCantidad(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000;
  const decimals = (String(rounded).split(".")[1] ?? "").length;
  return formatNumberAr(rounded, { maxDecimals: Math.min(4, decimals) });
}
