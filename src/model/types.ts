import { TurnoEstado } from "./dtos";

export type UUID = string;

export interface Particular {
  id: UUID
  nombre: string
  apellido?: string
  codigo_pais?: string
  telefono: string
  email: string
  direccion: string
  tipo_documento_fiscal?: DocumentoFiscalTipo | null
  numero_documento_fiscal?: string | null
  condicion_iva_receptor_id?: CondicionIvaReceptorId | null
  fce_mipyme_alcanzado?: boolean
  vehiculos: Vehiculo[]
}

export interface Representante {
  id: UUID;
  empresa_id: UUID;
  nombre: string;
  apellido: string;
  codigo_pais?: string;
  telefono: string;
}

export enum TipoCliente {
  PARTICULAR = "particular",
  EMPRESA = "empresa",
}

export type DocumentoFiscalTipo = 80 | 86 | 96;

export type CondicionIvaReceptorId =
  | 1 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 13 | 15 | 16;

export interface Cliente {
  id: UUID
  nombre: string
  tipo_cliente: TipoCliente
  codigo_pais?: string
  telefono: string
  email: string
  direccion: string
  cuit?: string
  tipo_documento_fiscal?: DocumentoFiscalTipo | null
  numero_documento_fiscal?: string | null
  condicion_iva_receptor_id?: CondicionIvaReceptorId | null
  fce_mipyme_alcanzado?: boolean
}

export interface Vehiculo {
  id: UUID;
  cliente_id?: UUID | null;
  nombre_cliente: string;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string;
  numero_chasis: string;
  nro_interno?: string | null;
}

export type EstadoArreglo =
  | "PRESUPUESTO"
  | "SIN_INICIAR"
  | "EN_PROGRESO"
  | "ESPERA"
  | "TERMINADO";

export const ESTADOS_ARREGLO: EstadoArreglo[] = [
  "PRESUPUESTO",
  "SIN_INICIAR",
  "EN_PROGRESO",
  "ESPERA",
  "TERMINADO",
];

export type EstadoPagoArreglo = "PENDIENTE" | "PARCIAL" | "PAGADO" | "SOBREPAGO";

export interface CobroArregloItem {
  id: string;
  operacion_id: string;
  importe: number;
  cuenta_id: string;
  cuenta_nombre: string;
  descripcion?: string | null;
  fecha: string;
  created_at: string;
}

export interface Arreglo {
  id: UUID;
  vehiculo: Vehiculo;
  taller_id: UUID;
  taller: Taller;
  estado: EstadoArreglo;
  descripcion: string;
  kilometraje_leido: number;
  fecha: string;
  observaciones: string;
  precio_final: number;
  precio_sin_iva: number;
  esta_pago: boolean;
  total_cobrado?: number;
  saldo_pendiente?: number;
  cobros?: CobroArregloItem[];
  fecha_cobro?: string | null;
  movimiento_financiero_id?: string | null;
  extra_data: string;
  categorias?: string[];
  empleados?: Array<{ id: string; nombre: string; apellido?: string }>;
}

export interface Turno {
	id: string;
	fecha: string; // YYYY-MM-DD
	hora: string; // HH:mm
	duracion: number | null; // minutos
	vehiculo: Vehiculo;
	cliente: Cliente;
	tipo: string | null;
	estado: TurnoEstado;
	telefono?: string;
	email?: string;
	descripcion?: string;
	mecanico?: string;
	observaciones?: string;
};

export interface SupabaseError {
  message: string;
  code?: string;
}

export interface Taller {
  id: string;
  nombre: string;
  ubicacion: string;
}

export interface OperacionLinea {
  id: UUID;
  operacion_id: UUID;
  stock_id: UUID;
  cantidad: number;
  monto_unitario: number;
  delta_cantidad: number;
  created_at: string;
  nombre?: string;
  codigo?: string;
}

export type TipoOperacion =
  | "COMPRA"
  | "VENTA"
  | "GASTO"
  | "ASIGNACION_ARREGLO"
  | "COBRO_ARREGLO"
  | "AJUSTE"
  | "INGRESO"
  | "APERTURA_CUENTA"
  | "TRANSFERENCIA"
  | "MOVIMIENTO_CUENTA";

export const TIPOS_OPERACIONES: TipoOperacion[] = [
  "COMPRA",
  "VENTA",
  "GASTO",
  "ASIGNACION_ARREGLO",
  "COBRO_ARREGLO",
  //"AJUSTE",
  //"TRANSFERENCIA",
];

export interface Operacion {
  id: UUID;
  tipo: TipoOperacion;
  /** Los gastos son globales del tenant y no pertenecen a un taller. */
  taller_id: UUID | null;
  fecha: string;
  created_at: string;
  lineas: OperacionLinea[];
  /** Los gastos se proyectan en Operaciones, pero no son operaciones de stock. */
  gasto_id?: UUID;
  descripcion?: string;
  categoria_gasto?: string;
  cuenta_financiera_id?: UUID;
  cuenta_financiera_nombre?: string;
  monto?: number;
  /** Arreglo asociado cuando la operación corresponde a uno de sus cobros. */
  arreglo_id?: UUID;
}

export type OperacionesFilters = {
  fecha?: string; // YYYY-MM-DD
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  tipo?: TipoOperacion[];
};
