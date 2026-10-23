import { EstadoArreglo, TipoCliente, TipoOperacion } from "./types";

export interface VehiculoDto {
    id: string;
    cliente_id: string;
    patente: string;
    marca?: string;
    modelo?: string;
    fecha_patente?: string;
    numero_chasis: string;
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
    numero_orden?: number | null;
    vehiculo_id: string;
    taller_id?: string;
    tipo: string;
    estado: EstadoArreglo;
    descripcion: string;
    kilometraje_leido: number;
    combustible_leido?: number | null;
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
    dni_cuil?: string | null;
    codigo_pais?: string;
    telefono: string;
    email: string;
    direccion: string;
}

export interface TurnoDto {
    id: string;
    titulo: string;
    fecha: string;
    hora: string;
    duracion: number | null;
    taller_id: string;
    vehiculo_id: string | null;
    cliente_id: string | null;
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
    show_in_stock: boolean;
    talleresConStock?: number;
    stocks?: StockDTO[];
    created_at: string;
    updated_at: string;
};

export type StockDTO = {
    id: string;
    tallerId: string;
    productoId: string;
    cantidad: number;
    cantidad_reservada?: number;
    cantidad_pendiente?: number;
    cantidad_disponible?: number;
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
    taller_id: string | null;
    fecha: string;
    created_at: string;
    monto_total?: number;
    total_pagado?: number;
    saldo_pendiente?: number;
    esta_pago?: boolean;
    estado_pago?: string;
    estado_stock?: string;
    observaciones?: string | null;
    proveedor_id?: string | null;
    proveedor_nombre?: string;
};

export type MovimientoStockDTO = {
    id: string;
    tenant_id: string;
    taller_id: string;
    taller_nombre?: string;
    producto_id: string;
    producto_nombre?: string;
    producto_codigo?: string;
    stock_id: string;
    operacion_id?: string | null;
    operacion_tipo?: string | null;
    tipo_movimiento: string;
    cantidad: number;
    saldo_anterior: number;
    saldo_posterior: number;
    fecha: string;
    motivo?: string | null;
    created_by?: string | null;
    created_at: string;
};

export type ProductoProveedorDTO = {
    id: string;
    tenant_id?: string;
    producto_id: string;
    proveedor_id: string;
    proveedor_nombre?: string;
    proveedor_cuit?: string;
    producto_nombre?: string;
    producto_codigo?: string;
    codigo_proveedor?: string | null;
    costo_referencia: number;
    es_predeterminado: boolean;
    created_at?: string;
    updated_at?: string;
};

export type OperacionLineaDTO = {
    id: string;
    operacion_id: string;
    stock_id: string;
    cantidad: number;
    cantidad_cumplida?: number;
    monto_unitario: number;
    delta_cantidad: number;
    created_at: string;
    nombre?: string;
    codigo?: string;
};

export type OperacionPagoDTO = {
    id: string;
    tenant_id?: string;
    operacion_id: string;
    cuenta_financiera_id: string;
    monto: number;
    fecha: string;
    descripcion?: string | null;
    created_at: string;
    cuenta_financiera_nombre?: string;
};

export type OperacionAsignacionArregloDTO = {
    operacion_id: string;
    arreglo_id: string;
};

export type EmpleadoDTO = {
    id: string;
    taller_id: string;
    nombre: string;
    apellido: string;
    dni: string;
    email: string | null;
    telefono: string | null;
    cumpleanos: string | null;
    salario: number | null;
    valor_hora: number | null;
    fecha_ingreso: string | null;
    created_at: string;
    updated_at: string;
};

export type FormularioTemplateDTO = {
    id: string;
    tenant_id: string;
    descripcion: string;
    costodefault: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
};
