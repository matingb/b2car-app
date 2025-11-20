import { TipoCliente } from "./types";

export interface VehiculoDto {
    id: string;
    cliente_id: string;
    patente: string;
    marca?: string;
    modelo?: string;
    fecha_patente?: string;
    created_at: string;
}

export interface ClienteDto {
    id: string;
    tipo_cliente: TipoCliente;
    puntaje: string;
    fecha_creacion: Date;
}

export interface ArregloDto {
    id: string;
    vehiculo_id: string;
    tipo: string;
    descripcion: string;
    kilometraje_leido: number;
    fecha: Date;
    observaciones: string;
    precio_final: number;
    precio_sin_iva: number;
    esta_pago: boolean;
    extra_data: string;
}

export interface ParticularDto {
    id: string;
    nombre: string;
    apellido?: string;
    telefono: string;
    email: string;
    direccion: string;
}
