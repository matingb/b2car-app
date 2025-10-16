export interface Representante {
  id: number;
  empresaId: number;
  nombre: string;
  apellido: string;
  telefono: string;
}

export type TipoCliente = "persona" | "empresa"; 

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: TipoCliente;
  puntaje: number;
  fecha_creacion: string;
}

export interface Vehiculo {
  id: number;
  cliente_id: number;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string;
}

export interface Arreglo {
  id: number;
  vehiculo_id: number;
  tipo: string;
  kilometraje_leido: number;
  fecha: string;
  observaciones: string;
  precio_final: number;
  precio_sin_iva: number;
  esta_pago: boolean;
  extra_data: string; 
}
