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
