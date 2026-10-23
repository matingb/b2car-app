/** Rango de un período del dashboard: `from` inclusivo, `to` exclusivo (timestamps ISO). */
export type DashboardRange = { from: string; to: string };

export type ArreglosResumen = {
  total: number;
  cobrados: number;
  pendientes: number;
  parciales: number;
  montoIngresos: number;
  montoCobradoTotal: number;
  montoCobradoParcial: number;
  montoPendienteParcial: number;
  montoPendiente: number;
};

/** `fecha` es el día calendario en GMT-3 (YYYY-MM-DD). */
export type ArreglosDia = { fecha: string; cantidad: number };
export type IngresosDia = { fecha: string; mano_de_obra: number; repuestos: number; ventas: number };
export type GastosDia = { fecha: string; repuestos: number; sueldos: number; eventuales: number };

/** Resumen y series diarias de un período, calculados sobre el mismo snapshot de la base. */
export type DashboardPeriodo = {
  resumen: ArreglosResumen;
  series: {
    arreglos: ArreglosDia[];
    ingresos: IngresosDia[];
    gastos: GastosDia[];
  };
};

export type DashboardStats = {
  totals?: {
    clientes?: number;
    vehiculos?: number;
    arreglos?: number;
    montoIngresos?: number;
    arreglosEsteMes?: number;
    gastos?: number;
    balance?: number;
  };
  recentActivities?: Array<{
    id: string;
    titulo: string;
    vehiculo: string;
    fechaUltimaActualizacion: string;
    monto: number;
  }>;
  arreglos?: {
    total?: number;
    cobrados?: number;
    parciales?: number;
    pendientes?: number;
    montoCobradoTotal?: number;
    montoCobradoParcial?: number;
    montoPendienteParcial?: number;
    montoPendiente?: number;
  };
  clientes?: {
    nuevosEsteMes?: {
      dias: string[];
      valor: number[];
    };
  };
  periodo?: DashboardPeriodo;
  facturacionPorTipo?: Array<{ label: string; cantidad: number; monto: number }>;
  facturacionPorEmpleado?: Array<{ label: string; cantidad: number; monto: number }>;
  costoPorTipo?: Array<{ label: string; cantidad: number; monto: number }>;
  costoPorEmpleado?: Array<{ label: string; cantidad: number; monto: number }>;
  lastUpdatedAt?: string;
  [key: string]: unknown;
};
