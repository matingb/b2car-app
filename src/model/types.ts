export interface Particular {
  id: number
  nombre: string
  apellido?: string
  telefono: string
  email: string
  direccion: string
  vehiculos: Vehiculo[]
}

export interface Representante {
  id: number;
  empresa_id: number;
  nombre: string;
  apellido: string;
  telefono: string;
}

export enum TipoCliente {
  PARTICULAR = "particular",
  EMPRESA = "empresa",
}


export interface Cliente {
  id: number
  nombre: string
  tipo_cliente: TipoCliente
  telefono: string
  email: string
  direccion: string
  cuit?: string
}

export interface Vehiculo {
  id: number;
  nombre_cliente: string;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string;
}

export interface Arreglo {
  id: number;
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
