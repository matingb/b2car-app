import type { DashboardPeriodo } from "./types";

export type PeriodoTotals = {
    arreglos: number;
    cobrados: number;
    parciales: number;
    pendientes: number;
    /** Saldo sin cobrar de los arreglos pendientes y de los cobrados parcialmente. */
    porCobrar: number;
    /** Igual que la card de Facturación: suma de precio final de los arreglos (sin ventas de mostrador). */
    facturacion: number;
    manoDeObra: number;
    repuestos: number;
    ventas: number;
    gastos: number;
    gastoRepuestos: number;
    sueldos: number;
    eventuales: number;
    balance: number;
    /** Balance sobre facturación; null si no hubo facturación. */
    margen: number | null;
};

const sum = <T>(items: T[], value: (item: T) => number) =>
    items.reduce((total, item) => total + value(item), 0);

/** Totales de un período con las mismas reglas que las cards del dashboard. */
export function computePeriodoTotals(periodo: DashboardPeriodo): PeriodoTotals {
    const { resumen, series } = periodo;
    const facturacion = resumen.montoIngresos;
    const gastoRepuestos = sum(series.gastos, (d) => d.repuestos);
    const sueldos = sum(series.gastos, (d) => d.sueldos);
    const eventuales = sum(series.gastos, (d) => d.eventuales);
    const gastos = gastoRepuestos + sueldos + eventuales;
    const balance = facturacion - gastos;

    return {
        arreglos: sum(series.arreglos, (d) => d.cantidad),
        cobrados: resumen.cobrados,
        parciales: resumen.parciales,
        pendientes: resumen.pendientes,
        porCobrar: resumen.montoPendiente + resumen.montoPendienteParcial,
        facturacion,
        manoDeObra: sum(series.ingresos, (d) => d.mano_de_obra),
        repuestos: sum(series.ingresos, (d) => d.repuestos),
        ventas: sum(series.ingresos, (d) => d.ventas),
        gastos,
        gastoRepuestos,
        sueldos,
        eventuales,
        balance,
        margen: facturacion !== 0 ? balance / facturacion : null,
    };
}
