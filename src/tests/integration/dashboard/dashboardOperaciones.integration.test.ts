import { describe, expect, it } from "vitest";
import {
  cuandoSeCobraUnArreglo,
  dadoUnArreglo,
  dadoUnArregloConRepuesto,
  dadoUnaCuentaFinanciera,
} from "../helpers/integrationFixtures";
import {
  anularCobroArregloViaRoute,
  borrarArregloViaRoute,
  eliminarDetalleArregloViaRoute,
  eliminarEmpleadoViaRoute,
  eliminarRepuestoLineaViaRoute,
} from "../helpers/routeDrivers";
import {
  arreglosDelDia,
  cuandoSeBorraLaOperacion,
  cuandoSeConsultaElDashboard,
  dadaUnaCompra,
  dadaUnaManoDeObra,
  dadaUnaVenta,
  dadoUnGasto,
  dadoUnSueldo,
  dadoUnaCuentaConSaldo,
  gastosDelDia,
  ingresosDelDia,
} from "./dashboardHelpers";

/**
 * Harness del dashboard: cada acción de negocio debe reflejarse en las series y
 * totales, y su reversión debe dejar el dashboard como estaba antes.
 */

const DIA = "2020-03-10";
const FECHA = `${DIA}T14:00:00-03:00`;
const SIN_INGRESOS = { fecha: DIA, mano_de_obra: 0, repuestos: 0, ventas: 0 };
const SIN_GASTOS = { fecha: DIA, repuestos: 0, sueldos: 0, eventuales: 0 };

describe("Integration: dashboard - arreglos", () => {
  it("un arreglo suma una unidad a su día y su precio final a la mano de obra", async () => {
    await dadoUnArreglo({ fecha: FECHA, precio_final: 20000 });

    const stats = await cuandoSeConsultaElDashboard();

    expect(arreglosDelDia(stats, DIA)).toBe(1);
    expect(ingresosDelDia(stats, DIA)).toEqual({ ...SIN_INGRESOS, mano_de_obra: 20000 });
    expect(stats.totals?.montoIngresos).toBe(20000);
  });

  it("al borrar el arreglo, vuelve a cero el conteo y los ingresos", async () => {
    const arreglo = await dadoUnArreglo({ fecha: FECHA, precio_final: 20000 });

    await borrarArregloViaRoute(arreglo.id);

    const stats = await cuandoSeConsultaElDashboard();
    expect(arreglosDelDia(stats, DIA)).toBe(0);
    expect(ingresosDelDia(stats, DIA)).toEqual(SIN_INGRESOS);
    expect(stats.totals?.montoIngresos).toBe(0);
  });

  it("un presupuesto no cuenta como arreglo ni como ingreso", async () => {
    await dadoUnArreglo({ fecha: FECHA, estado: "PRESUPUESTO", precio_final: 20000 });

    const stats = await cuandoSeConsultaElDashboard();

    expect(arreglosDelDia(stats, DIA)).toBe(0);
    expect(ingresosDelDia(stats, DIA)).toEqual(SIN_INGRESOS);
  });

  it("un cobro suma al monto cobrado y al anularlo reabre la deuda", async () => {
    const cuenta = await dadoUnaCuentaFinanciera();
    const arreglo = await dadoUnArreglo({ fecha: FECHA, estado: "EN_PROGRESO", precio_final: 20000 });
    const detalle = await cuandoSeCobraUnArreglo(arreglo.id, { cuenta_financiera_id: cuenta.id, monto: 20000 });
    const operacionId = detalle?.cobros?.[0]?.operacion_id ?? "";
    expect((await cuandoSeConsultaElDashboard()).arreglos?.montoCobradoTotal).toBe(20000);

    await anularCobroArregloViaRoute(arreglo.id, operacionId);

    const stats = await cuandoSeConsultaElDashboard();
    expect(stats.arreglos?.montoCobradoTotal).toBe(0);
    expect(stats.arreglos?.montoPendiente).toBe(20000);
  });
});

describe("Integration: dashboard - mano de obra", () => {
  it("un detalle de mano de obra se suma a los ingresos de mano de obra del día", async () => {
    const { arreglo } = await dadoUnArregloConRepuesto({ fecha: FECHA, cantidadAsignada: 1, precioUnitario: 3000 });

    await dadaUnaManoDeObra(arreglo.id, 7000);

    const stats = await cuandoSeConsultaElDashboard();
    expect(ingresosDelDia(stats, DIA)).toEqual({ ...SIN_INGRESOS, mano_de_obra: 7000, repuestos: 3000 });
  });

  it("al eliminar el detalle, la mano de obra vuelve al valor anterior", async () => {
    const { arreglo } = await dadoUnArregloConRepuesto({ fecha: FECHA, cantidadAsignada: 1, precioUnitario: 3000 });
    const detalleId = await dadaUnaManoDeObra(arreglo.id, 7000);

    await eliminarDetalleArregloViaRoute(arreglo.id, detalleId);

    const stats = await cuandoSeConsultaElDashboard();
    expect(ingresosDelDia(stats, DIA)).toEqual({ ...SIN_INGRESOS, repuestos: 3000 });
  });
});

describe("Integration: dashboard - repuestos de arreglos", () => {
  it("el repuesto asignado se cuenta por cantidad × monto unitario en ingresos de repuestos", async () => {
    await dadoUnArregloConRepuesto({ fecha: FECHA, cantidadAsignada: 2, precioUnitario: 1500 });

    const stats = await cuandoSeConsultaElDashboard();

    expect(ingresosDelDia(stats, DIA)).toEqual({ ...SIN_INGRESOS, repuestos: 3000 });
  });

  it("al quitar el repuesto, los ingresos de repuestos vuelven a cero", async () => {
    const { arreglo, lineaId } = await dadoUnArregloConRepuesto({
      fecha: FECHA,
      cantidadAsignada: 2,
      precioUnitario: 1500,
    });

    const res = await eliminarRepuestoLineaViaRoute(arreglo.id, lineaId);

    expect(res.status).toBe(200);
    const stats = await cuandoSeConsultaElDashboard();
    expect(ingresosDelDia(stats, DIA)?.repuestos).toBe(0);
  });
});

describe("Integration: dashboard - ventas de mostrador", () => {
  it("una venta se suma a los ingresos por ventas del día", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadaUnaVenta(cuentaId, FECHA, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    expect(ingresosDelDia(stats, DIA)).toEqual({ ...SIN_INGRESOS, ventas: 4000 });
  });

  it("al borrar la venta, los ingresos por ventas vuelven a cero", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    const ventaId = await dadaUnaVenta(cuentaId, FECHA, 4000);

    await cuandoSeBorraLaOperacion(ventaId);

    const stats = await cuandoSeConsultaElDashboard();
    expect(ingresosDelDia(stats, DIA)).toEqual(SIN_INGRESOS);
  });
});

describe("Integration: dashboard - compras de repuestos", () => {
  it("una compra se suma al gasto en repuestos del día y al total de gastos", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadaUnaCompra(cuentaId, FECHA, 3000);

    const stats = await cuandoSeConsultaElDashboard();

    expect(gastosDelDia(stats, DIA)).toEqual({ ...SIN_GASTOS, repuestos: 3000 });
    expect(stats.totals?.gastos).toBe(3000);
  });

  it("al borrar la compra, el gasto en repuestos vuelve a cero", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    const compraId = await dadaUnaCompra(cuentaId, FECHA, 3000);

    await cuandoSeBorraLaOperacion(compraId);

    const stats = await cuandoSeConsultaElDashboard();
    expect(gastosDelDia(stats, DIA)).toEqual(SIN_GASTOS);
    expect(stats.totals?.gastos).toBe(0);
  });
});

describe("Integration: dashboard - gastos eventuales", () => {
  it("un gasto se suma a los gastos eventuales del día y al total de gastos", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadoUnGasto(cuentaId, FECHA, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    expect(gastosDelDia(stats, DIA)).toEqual({ ...SIN_GASTOS, eventuales: 4000 });
    expect(stats.totals?.gastos).toBe(4000);
  });

  it("al borrar el gasto, los gastos eventuales vuelven a cero", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    const gastoId = await dadoUnGasto(cuentaId, FECHA, 4000);

    await cuandoSeBorraLaOperacion(gastoId);

    const stats = await cuandoSeConsultaElDashboard();
    expect(gastosDelDia(stats, DIA)).toEqual(SIN_GASTOS);
    expect(stats.totals?.gastos).toBe(0);
  });
});

describe("Integration: dashboard - sueldos", () => {
  it("el sueldo vigente se imputa al primer día del mes y al total de gastos", async () => {
    await dadoUnSueldo(50000, "2020-03-01");

    const stats = await cuandoSeConsultaElDashboard();

    expect(gastosDelDia(stats, "2020-03-01")).toEqual({ fecha: "2020-03-01", repuestos: 0, sueldos: 50000, eventuales: 0 });
    expect(stats.totals?.gastos).toBe(50000);
  });

  it("al eliminar al empleado, el sueldo desaparece de los gastos", async () => {
    const empleadoId = await dadoUnSueldo(50000, "2020-03-01");

    const res = await eliminarEmpleadoViaRoute(empleadoId);

    expect(res.status).toBe(200);
    const stats = await cuandoSeConsultaElDashboard();
    expect(gastosDelDia(stats, "2020-03-01")?.sueldos).toBe(0);
    expect(stats.totals?.gastos).toBe(0);
  });
});

describe("Integration: dashboard - balance", () => {
  it("el balance es la facturación menos compras, gastos y sueldos, y se recompone al revertir", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadoUnArreglo({ fecha: FECHA, precio_final: 100000 });
    const compraId = await dadaUnaCompra(cuentaId, FECHA, 3000);
    const gastoId = await dadoUnGasto(cuentaId, FECHA, 4000);
    await dadoUnSueldo(50000, "2020-03-01");
    expect((await cuandoSeConsultaElDashboard()).totals?.balance).toBe(100000 - 3000 - 4000 - 50000);

    await cuandoSeBorraLaOperacion(compraId);
    await cuandoSeBorraLaOperacion(gastoId);

    expect((await cuandoSeConsultaElDashboard()).totals?.balance).toBe(100000 - 50000);
  });
});
