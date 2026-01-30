import { TipoCliente, TipoOperacion } from "./types";

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
    taller_id?: string;
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

export interface TurnoDto {
    id: string;
    fecha: string;
    hora: string;
    duracion: number | null;
    vehiculo_id: string;
    cliente_id: string;
    tipo: string | null;
    estado: TurnoEstado;
    descripcion: string | null;
    observaciones: string | null;
};

export type TurnoEstado = "confirmado" | "pendiente" | "cancelado";

export type ProductoDTO = {
    id: string;
    codigo: string;
    nombre: string;
    marca: string | null;
    modelo: string | null;
    descripcion: string | null;
    precio_unitario: number;
    costo_unitario: number;
    proveedor: string | null;
    categorias: string[];
    talleresConStock?: number;
    created_at: string;
    updated_at: string;
};

export type StockDTO = {
    id: string;
    tallerId: string;
    productoId: string;
    cantidad: number;
    stock_minimo: number;
    stock_maximo: number;
    created_at: string;
    updated_at: string;
};

export type StockItemDTO = StockDTO & {
    producto: ProductoDTO | null;
};

export type ProductoDetailDTO = ProductoDTO & {
    stocks: StockDTO[];
};

export type OperacionDTO = {
    id: string;
    tenant_id: string;
    tipo: TipoOperacion;
    taller_id: string;
    created_at: string;
};

export type OperacionLineaDTO = {
    id: string;
    operacion_id: string;
    producto_id: string;
    cantidad: number;
    monto_unitario: number;
    delta_cantidad: number;
    created_at: string;
};

export type OperacionAsignacionArregloDTO = {
    operacion_id: string;
    arreglo_id: string;
};
