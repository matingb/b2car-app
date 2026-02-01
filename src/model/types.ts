import { TurnoEstado } from "./dtos";

export type UUID = string;

export interface Particular {
  id: UUID
  nombre: string
  apellido?: string
  telefono: string
  email: string
  direccion: string
  vehiculos: Vehiculo[]
}

export interface Representante {
  id: UUID;
  empresa_id: UUID;
  nombre: string;
  apellido: string;
  telefono: string;
}

export enum TipoCliente {
  PARTICULAR = "particular",
  EMPRESA = "empresa",
}

export interface Cliente {
  id: UUID
  nombre: string
  tipo_cliente: TipoCliente
  telefono: string
  email: string
  direccion: string
  cuit?: string
}

export interface Vehiculo {
  id: UUID;
  nombre_cliente: string;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string;
  nro_interno?: string | null;
}

export interface Arreglo {
  id: UUID;
  vehiculo: Vehiculo;
  taller_id: UUID;
  taller: Taller;
  tipo: string;
  descripcion: string;
  kilometraje_leido: number;
  fecha: string;
  observaciones: string;
  precio_final: number;
  precio_sin_iva: number;
  esta_pago: boolean;
  extra_data: string; 
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
}

export type TipoOperacion =
  | "COMPRA"
  | "VENTA"
  | "ASIGNACION_ARREGLO"
  | "AJUSTE"
  | "TRANSFERENCIA";

export const TIPOS_OPERACIONES: TipoOperacion[] = [
  "COMPRA",
  "VENTA",
  "ASIGNACION_ARREGLO",
  "AJUSTE",
  "TRANSFERENCIA",
];

export interface Operacion {
  id: UUID;
  tipo: TipoOperacion;
  taller_id: UUID;
  created_at: string;
  lineas: OperacionLinea[];
}

export type OperacionesFilters = {
  fecha?: string; // YYYY-MM-DD
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  tipo?: TipoOperacion[];
};