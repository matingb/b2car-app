export type DocumentoFiscalTipo = 80 | 86 | 96;

export type CondicionIvaReceptorId =
  | 1
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 13
  | 15
  | 16;

export type FacturaElectronicaEstado =
  | "PENDIENTE"
  | "AUTORIZADA"
  | "RECHAZADA"
  | "INCIERTA";

export type FacturaConcepto = 1 | 2 | 3;

export type FacturaLineaOrigen = "SERVICIO" | "FORMULARIO" | "REPUESTO";

export type PerfilFiscalCliente = {
  clienteId: string;
  nombre: string;
  domicilio: string | null;
  tipoDocumento: DocumentoFiscalTipo | null;
  numeroDocumento: string | null;
  condicionIvaReceptorId: CondicionIvaReceptorId | null;
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
  snapshot?: Record<string, unknown>;
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
  numeroComprobante: number | null;
  cae: string | null;
  caeVencimiento: string | null;
  total: number;
  concepto: FacturaConcepto;
  createdAt?: string;
};

export type FacturacionConfiguracionPublica = {
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  domicilio: string;
  ingresosBrutos: string | null;
  inicioActividades: string;
  puntoVenta: number;
  habilitada: boolean;
  ambiente: "HOMOLOGACION";
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
  puedeEmitir: boolean;
  configuracionCompleta: boolean;
  arregloTerminado: boolean;
  diferenciasTotal: boolean;
  mensaje?: string;
  emisor?: Pick<FacturacionConfiguracionPublica, "razonSocial" | "cuit" | "puntoVenta">;
  receptor: PerfilFiscalCliente;
  concepto: FacturaConcepto;
  lineas: FacturaLinea[];
  total: number;
  precioFinal: number;
  fechasDefault: FacturaFechaInput;
};

export const CONDICIONES_IVA_RECEPTOR: Array<{
  id: CondicionIvaReceptorId;
  label: string;
}> = [
  { id: 1, label: "Responsable inscripto" },
  { id: 4, label: "IVA exento" },
  { id: 5, label: "Consumidor final" },
  { id: 6, label: "Monotributista" },
  { id: 7, label: "Sujeto no categorizado" },
  { id: 8, label: "Proveedor del exterior" },
  { id: 9, label: "Cliente del exterior" },
  { id: 10, label: "IVA liberado - Ley 19.640" },
  { id: 13, label: "Monotributista social" },
  { id: 15, label: "IVA no alcanzado" },
  { id: 16, label: "Monotributo trabajador promovido" },
];

export const TIPOS_DOCUMENTO_FISCAL: Array<{
  id: DocumentoFiscalTipo;
  label: string;
}> = [
  { id: 96, label: "DNI" },
  { id: 86, label: "CUIL" },
  { id: 80, label: "CUIT" },
];
