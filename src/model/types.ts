import { TurnoEstado } from "./dtos";

export type UUID = string;

export interface Particular {
  id: UUID
  nombre: string
  apellido?: string
  /** DNI (7/8 dígitos) o CUIL (11 dígitos), sin formato. */
  dni_cuil?: string | null
  codigo_pais?: string
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
  codigo_pais?: string;
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
  codigo_pais?: string
  telefono: string
  email: string
  direccion: string
  cuit?: string
  dni_cuil?: string | null
  saldo_cuenta?: number
  vehiculos?: Vehiculo[]
  vehiculos_count?: number
}

export interface Proveedor {
  id: UUID;
  nombre: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  created_at?: string;
  updated_at?: string;
  saldo_pendiente?: number;
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
  color?: string;
  numero_motor?: string;
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

export interface FacturaElectronicaBadgeInfo {
  id?: string;
  estado?: string;
  clase_comprobante?: string;
  punto_venta?: number;
  numero_comprobante?: number;
}

export interface Arreglo {
  id: UUID;
  numero_orden?: number | null;
  vehiculo: Vehiculo;
  taller_id: UUID;
  taller: Taller;
  estado: EstadoArreglo;
  descripcion: string;
  kilometraje_leido: number;
  combustible_leido?: number | null;
  fecha: string;
  observaciones: string;
  precio_final: number;
  precio_sin_iva: number;
  precios_incluyen_iva?: boolean;
  tasa_iva?: number;
  esta_pago: boolean;
  total_cobrado?: number;
  saldo_pendiente?: number;
  cobros?: CobroArregloItem[];
  fecha_cobro?: string | null;
  movimiento_financiero_id?: string | null;
  cliente_id?: UUID;
  es_facturable?: boolean;
  factura_electronica?: FacturaElectronicaBadgeInfo | null;
  extra_data: string;
  categorias?: string[];
  empleados?: Array<{ id: string; nombre: string; apellido?: string }>;
  /** Repuestos de un presupuesto nuevo, aun no materializados en stock. */
  repuestos_pendientes?: RepuestoPendiente[] | null;
}

export type RepuestoPendiente = {
  id: string;
  tipo: "EXISTENTE" | "NUEVO";
  stock_id?: string | null;
  codigo?: string | null;
  nombre?: string | null;
  cantidad: number;
  monto_unitario: number;
  precio_compra?: number | null;
  precio_venta?: number | null;
  categoria_arreglo_id?: string | null;
  empleado_id?: string | null;
};

export interface ClienteResumenFinanciero {
  saldo_cuenta: number;
  saldo_a_facturar: number;
  total_historico_trabajos: number;
  total_historico_cobrado: number;
  cantidad_arreglos_pendientes_pago: number;
  cantidad_arreglos_pendientes_factura: number;
}

export interface ClienteMovimientoCuenta {
  id: string;
  fecha: string;
  created_at: string;
  tipo_movimiento: "CARGO_ARREGLO" | "COBRO" | string;
  concepto: string;
  comprobante?: string | null;
  debito: number;
  credito: number;
  saldo_acumulado?: number;
  arreglo_id?: string | null;
  operacion_id?: string | null;
  cuenta_nombre?: string | null;
}

export interface Turno {
	id: string;
	titulo: string;
	fecha: string; // YYYY-MM-DD
	hora: string; // HH:mm
	duracion: number | null; // minutos
	taller_id: UUID;
	taller?: Taller | null;
	vehiculo?: Vehiculo | null;
	cliente?: Cliente | null;
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
  valor_hora?: number;
}

export type EstadoPagoOperacion = "PAGADO" | "PARCIAL" | "PENDIENTE";
export type EstadoStockOperacion = "ENTREGADO" | "PARCIAL" | "PENDIENTE" | "NO_APLICA";

export interface OperacionPago {
  id: UUID;
  tenant_id?: UUID;
  operacion_id: UUID;
  operacion_pago_id?: UUID | null;
  cuenta_financiera_id: UUID;
  cuenta_financiera_nombre?: string;
  monto: number;
  fecha: string;
  descripcion?: string | null;
  created_at: string;
}

export interface OperacionMovimientoStock {
  id: UUID;
  fecha: string;
  cantidad: number;
  saldo_anterior: number;
  saldo_posterior: number;
  motivo?: string | null;
  created_at: string;
  created_by?: UUID | null;
  producto_id: UUID;
  stock_id: UUID;
  producto_nombre?: string;
  producto_codigo?: string;
}

export interface OperacionLinea {
  id: UUID;
  operacion_id: UUID;
  stock_id: UUID;
  cantidad: number;
  cantidad_cumplida?: number;
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
  taller_id: UUID | null;
  fecha: string;
  created_at: string;
  lineas: OperacionLinea[];
  gasto_id?: UUID;
  descripcion?: string;
  categoria_gasto?: string;
  cuenta_financiera_id?: UUID;
  cuenta_financiera_nombre?: string;
  monto?: number;
  monto_total?: number;
  total_pagado?: number;
  saldo_pendiente?: number;
  esta_pago?: boolean;
  estado_pago?: EstadoPagoOperacion;
  estado_stock?: EstadoStockOperacion;
  pagos?: OperacionPago[];
  arreglo_id?: UUID;
  factura_asociada?: boolean;
  observaciones?: string;
  proveedor_id?: UUID | null;
  proveedor_nombre?: string;
  cliente_id?: UUID | null;
  cliente_nombre?: string;
  movimientos_stock?: OperacionMovimientoStock[];
}

export interface OperacionVenta {
  operacion_id: UUID;
  tenant_id: UUID;
  cliente_id: UUID;
  cliente_nombre?: string;
  created_at: string;
}

export interface OperacionCompra {
  operacion_id: UUID;
  tenant_id: UUID;
  proveedor_id: UUID;
  proveedor_nombre?: string;
  created_at: string;
}

export type TipoMovimientoStock =
  | "COMPRA"
  | "VENTA"
  | "ASIGNACION_ARREGLO"
  | "AJUSTE"
  | "REVERSION"
  | "INICIAL"
  | "DEVOLUCION_NC";

export interface MovimientoStock {
  id: UUID;
  tenant_id: UUID;
  taller_id: UUID;
  taller_nombre?: string;
  producto_id: UUID;
  producto_nombre?: string;
  producto_codigo?: string;
  stock_id: UUID;
  operacion_id?: UUID | null;
  operacion_tipo?: string | null;
  detalle_arreglo_id?: UUID | null;
  tipo_movimiento: TipoMovimientoStock;
  cantidad: number;
  saldo_anterior: number;
  saldo_posterior: number;
  fecha: string;
  motivo?: string | null;
  created_by?: UUID | null;
  created_at: string;
}

export interface ProductoProveedor {
  id: UUID;
  tenant_id?: UUID;
  producto_id: UUID;
  proveedor_id: UUID;
  proveedor_nombre?: string;
  proveedor_cuit?: string;
  producto_nombre?: string;
  producto_codigo?: string;
  codigo_proveedor?: string | null;
  costo_referencia: number;
  es_predeterminado: boolean;
  created_at?: string;
  updated_at?: string;
}

export type OperacionesFilters = {
  fecha?: string; // YYYY-MM-DD
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  tipo?: TipoOperacion[];
};
