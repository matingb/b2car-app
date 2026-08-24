/**
 * Contrato compartido de la contabilidad operativa.
 *
 * Dos entidades separadas:
 *   - MovimientoCuenta: evento de negocio explícito (GASTO, INGRESO, TRANSFERENCIA).
 *   - MovimientoFinanciero: entrada del ledger inmutable, derivada automáticamente.
 */

export type TipoCuentaFinanciera =
  | "EFECTIVO"
  | "CUENTA_BANCARIA"
  | "BILLETERA_DIGITAL"
  | "TARJETA_CREDITO";

export const CUENTA_TIPOS: readonly TipoCuentaFinanciera[] = [
  "EFECTIVO",
  "CUENTA_BANCARIA",
  "BILLETERA_DIGITAL",
  "TARJETA_CREDITO",
];

export const CUENTA_TIPO_LABELS: Record<TipoCuentaFinanciera, string> = {
  EFECTIVO: "Efectivo",
  CUENTA_BANCARIA: "Cuenta bancaria",
  BILLETERA_DIGITAL: "Billetera digital",
  TARJETA_CREDITO: "Tarjeta de crédito",
};

export const CUENTAS_TIPOS: ReadonlyArray<{ value: TipoCuentaFinanciera; label: string }> = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "CUENTA_BANCARIA", label: "Cuenta bancaria" },
  { value: "BILLETERA_DIGITAL", label: "Billetera digital" },
  { value: "TARJETA_CREDITO", label: "Tarjeta de crédito" },
];

export function getCuentaTipoLabel(value: string | null | undefined): string {
  const tipo = value?.toUpperCase() as TipoCuentaFinanciera | undefined;
  return (tipo && CUENTA_TIPO_LABELS[tipo]) || "Cuenta";
}

/** Subtipo de un MOVIMIENTO_CUENTA (lo que el usuario registra explícitamente). */
export type SubtipoMovimientoCuenta =
  | "GASTO"
  | "INGRESO"
  | "TRANSFERENCIA"
  | "APERTURA_CUENTA"
  | (string & {});

/**
 * @deprecated Usar SubtipoMovimientoCuenta.
 * Mantenido temporalmente para compatibilidad con código existente.
 */
export type TipoMovimientoFinanciero = SubtipoMovimientoCuenta | "COBRO_ARREGLO" | "COMPRA_STOCK" | "VENTA_STOCK" | "MOVIMIENTO";

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

export const CATEGORIAS_GASTO: ReadonlyArray<{ value: CategoriaGastoFinanciero; label: string }> = [
  { value: "ALQUILER", label: "Alquiler" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "SUELDOS_HONORARIOS", label: "Sueldos y honorarios" },
  { value: "IMPUESTOS", label: "Impuestos" },
  { value: "INSUMOS_REPUESTOS", label: "Insumos y repuestos" },
  { value: "HERRAMIENTAS_EQUIPAMIENTO", label: "Herramientas y equipamiento" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "TRANSPORTE_COMBUSTIBLE", label: "Transporte y combustible" },
  { value: "MARKETING_PUBLICIDAD", label: "Marketing y publicidad" },
  { value: "COMISIONES_GASTOS_BANCARIOS", label: "Comisiones y gastos bancarios" },
  { value: "OTROS", label: "Otros" },
];

export type CuentaFinanciera = {
  id: string;
  nombre: string;
  tipo: TipoCuentaFinanciera;
  saldoInicial: number;
  saldoActual: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  movimientos?: MovimientoFinanciero[];
};

/** Entrada del ledger inmutable. Derivada automáticamente de operaciones. */
export type MovimientoFinanciero = {
  id: string;
  cuentaId: string;
  /** Tipo derivado de la operación fuente: subtipo OMC o tipo_operacion. */
  tipo: TipoMovimientoFinanciero;
  importe: number;
  fecha: string;
  descripcion: string | null;
  categoria: string | null;
  operacionId: string | null;
  arregloId?: string | null;
  /** @deprecated Siempre null en la nueva arquitectura. */
  reversaMovimientoId: string | null;
  createdAt: string;
};

/** Evento financiero explícito registrado por el usuario (tipo MOVIMIENTO_CUENTA). */
export type MovimientoCuenta = {
  /** ID de la operación base. */
  id: string;
  subtipo: SubtipoMovimientoCuenta;
  /** Solo para GASTO, INGRESO, APERTURA_CUENTA. */
  cuentaId: string | null;
  cuentaNombre?: string | null;
  /** Solo para TRANSFERENCIA. */
  cuentaOrigenId: string | null;
  cuentaOrigenNombre?: string | null;
  cuentaDestinoId: string | null;
  cuentaDestinoNombre?: string | null;
  /** Importe como lo ve el usuario (siempre positivo). */
  importe: number;
  categoria: string | null;
  descripcion: string | null;
  arregloId: string | null;
  fecha: string;
  createdAt: string;
};

/** @deprecated Usar MovimientoCuenta con subtipo='TRANSFERENCIA'. */
export type TransferenciaFinanciera = {
  id: string;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string | null;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string | null;
  importe: number;
  fecha: string;
  descripcion: string | null;
  reversaMovimientoId: string | null;
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
  reversaMovimientoId?: string | null;
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
