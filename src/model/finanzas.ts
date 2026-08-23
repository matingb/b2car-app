/**
 * Contrato compartido de la contabilidad operativa. Las cuentas, movimientos,
 * transferencias y gastos se exponen con nombres en camelCase, sin filtrar la
 * representación interna de las RPC de Postgres hacia los componentes.
 */

export type TipoCuentaFinanciera =
  | "EFECTIVO"
  | "CUENTA_BANCARIA"
  | "BILLETERA_DIGITAL"
  | "TARJETA_CREDITO"
  | "OTRO";

export type TipoMovimientoFinanciero =
  | "APERTURA_CUENTA"
  | "TRANSFERENCIA"
  | "GASTO"
  | "COBRO_ARREGLO"
  | "COMPRA_STOCK"
  | "VENTA_STOCK"
  | "REVERSO"
  | (string & {});

export const CATEGORIAS_GASTO_FINANCIERO = [
  "ALQUILER",
  "SERVICIOS",
  "SUELDOS_HONORARIOS",
  "IMPUESTOS",
  "INSUMOS_REPUESTOS",
  "HERRAMIENTAS_EQUIPAMIENTO",
  "MANTENIMIENTO",
  "SEGUROS",
  "TRANSPORTE_COMBUSTIBLE",
  "MARKETING_PUBLICIDAD",
  "COMISIONES_GASTOS_BANCARIOS",
  "OTROS",
] as const;

export type CategoriaGastoFinanciero = (typeof CATEGORIAS_GASTO_FINANCIERO)[number];

export type CuentaFinanciera = {
  id: string;
  nombre: string;
  tipo: TipoCuentaFinanciera;
  saldoInicial: number;
  saldoActual: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MovimientoFinanciero = {
  id: string;
  eventoId: string;
  cuentaId: string;
  tipo: TipoMovimientoFinanciero;
  importe: number;
  fecha: string;
  descripcion: string | null;
  categoria: string | null;
  arregloId: string | null;
  operacionId: string | null;
  reversaEventoId: string | null;
  createdAt: string;
};

export type TransferenciaFinanciera = {
  id: string;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string | null;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string | null;
  importe: number;
  fecha: string;
  descripcion: string | null;
  reversaEventoId: string | null;
  createdAt: string;
};

export type GastoFinanciero = {
  id: string;
  cuentaId: string;
  cuentaNombre?: string | null;
  categoria: string;
  importe: number;
  fecha: string;
  descripcion: string;
  reversaEventoId?: string | null;
  createdAt: string;
  /** Metadata supplied by operation contexts; the current gasto read RPC does not return it. */
  arregloId?: string | null;
  operacionId?: string | null;
  updatedAt?: string;
};

export type CrearCuentaFinancieraInput = {
  nombre: string;
  tipo: TipoCuentaFinanciera;
  saldoInicial?: number;
  fecha?: string;
  idempotencyKey?: string;
};

export type ActualizarCuentaFinancieraInput = Partial<{
  nombre: string;
  tipo: TipoCuentaFinanciera;
  activo: boolean;
}>;

export type CrearTransferenciaFinancieraInput = {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  importe: number;
  fecha?: string;
  descripcion?: string | null;
  idempotencyKey?: string;
};

export type ActualizarTransferenciaFinancieraInput = Partial<{
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  importe: number;
  fecha: string;
  descripcion: string | null;
  idempotencyKey: string;
}>;

export type CrearGastoFinancieroInput = {
  cuentaId: string;
  categoria: string;
  importe: number;
  descripcion: string;
  fecha?: string;
  arregloId?: string | null;
  operacionId?: string | null;
  idempotencyKey?: string;
};

export type ActualizarGastoFinancieroInput = Partial<{
  cuentaId: string;
  categoria: string;
  importe: number;
  fecha: string;
  descripcion: string;
  idempotencyKey: string;
}>;

export type ListarMovimientosFinancierosInput = {
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
};

export type ListarGastosFinancierosInput = ListarMovimientosFinancierosInput;

export type FinanzasResponse<T> = {
  data: T | null;
  error?: string | null;
};

export type EliminarFinanzasResponse = {
  error?: string | null;
};

export type ListarCuentasFinancierasResponse = FinanzasResponse<CuentaFinanciera[]>;
export type ObtenerCuentaFinancieraResponse = FinanzasResponse<CuentaFinanciera>;
export type CrearCuentaFinancieraResponse = FinanzasResponse<CuentaFinanciera>;
export type ActualizarCuentaFinancieraResponse = FinanzasResponse<CuentaFinanciera>;
export type ListarMovimientosFinancierosResponse = FinanzasResponse<MovimientoFinanciero[]>;
export type CrearTransferenciaFinancieraResponse = FinanzasResponse<TransferenciaFinanciera>;
export type ActualizarTransferenciaFinancieraResponse = FinanzasResponse<TransferenciaFinanciera>;
export type ListarGastosFinancierosResponse = FinanzasResponse<GastoFinanciero[]>;
export type ObtenerGastoFinancieroResponse = FinanzasResponse<GastoFinanciero>;
export type CrearGastoFinancieroResponse = FinanzasResponse<GastoFinanciero>;
export type ActualizarGastoFinancieroResponse = FinanzasResponse<GastoFinanciero>;
