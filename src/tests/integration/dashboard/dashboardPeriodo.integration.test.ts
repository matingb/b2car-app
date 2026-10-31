import { describe, expect, it } from "vitest";
import {
  dadoUnArreglo,
  dadoUnArregloConRepuesto,
} from "../helpers/integrationFixtures";
import {
  clientesNuevosPorDia,
  cuandoSeConsultaElDashboard,
  cuandoSeConsultaElPeriodo,
  dadaUnaCompra,
  dadaUnaManoDeObra,
  dadaUnaVenta,
  dadoUnClienteCreadoEl,
  dadoUnGasto,
  dadoUnSueldo,
  dadoUnaCuentaConSaldo,
  diasConDatos,
  fechasConDatos,
  gastosDelDia,
  ingresosDelDia,
} from "./dashboardHelpers";
import { arregloService } from "@/app/api/arreglos/arregloService";
import { testClient } from "@/tests/integration";

describe("Integration: dashboard - zona horaria de Buenos Aires", () => {
  // 22:30 en GMT-3 ya es el día siguiente en UTC: debe figurar el día 15, no el 16.
  const fecha = "2020-03-15T22:30:00-03:00";

  it("ubica un arreglo en su día de Buenos Aires", async () => {
    await dadoUnArreglo({ fecha });

    const { periodo } = await cuandoSeConsultaElDashboard();

    expect(fechasConDatos(periodo!.series.arreglos, (d) => d.cantidad)).toEqual({ "2020-03-15": 1 });
  });

  it("ubica una venta en su día de Buenos Aires", async () => {
    await dadaUnaVenta(await dadoUnaCuentaConSaldo(), fecha, 1500);

    const { periodo } = await cuandoSeConsultaElDashboard();

    expect(fechasConDatos(periodo!.series.ingresos, (d) => d.ventas)).toEqual({ "2020-03-15": 1500 });
  });

  it("ubica una compra en su día de Buenos Aires", async () => {
    await dadaUnaCompra(await dadoUnaCuentaConSaldo(), fecha, 800);

    const { periodo } = await cuandoSeConsultaElDashboard();

    expect(fechasConDatos(periodo!.series.gastos, (d) => d.repuestos)).toEqual({ "2020-03-15": 800 });
  });

  it("ubica un gasto eventual en su día de Buenos Aires", async () => {
    await dadoUnGasto(await dadoUnaCuentaConSaldo(), fecha, 300);

    const { periodo } = await cuandoSeConsultaElDashboard();

    expect(fechasConDatos(periodo!.series.gastos, (d) => d.eventuales)).toEqual({ "2020-03-15": 300 });
  });

  it("ubica un cliente nuevo en su día de Buenos Aires", async () => {
    await dadoUnClienteCreadoEl(fecha);

    const stats = await cuandoSeConsultaElDashboard();

    expect(diasConDatos(clientesNuevosPorDia(stats), (d) => d.valor)).toEqual({ "15/03": 1 });
  });
});

describe("Integration: dashboard - desglose diario", () => {
  const fecha = "2020-03-10T14:00:00-03:00";

  it("separa en el mismo día mano de obra, repuestos y ventas de mostrador", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    const { arreglo } = await dadoUnArregloConRepuesto({ fecha, cantidadAsignada: 2, precioUnitario: 1500 });
    await dadaUnaManoDeObra(arreglo.id, 7000);
    await dadaUnaVenta(cuentaId, fecha, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    expect(ingresosDelDia(stats, "2020-03-10")).toEqual({
      fecha: "2020-03-10",
      mano_de_obra: 7000,
      repuestos: 3000,
      ventas: 4000,
    });
  });

  it("separa en el mismo día compras, gastos eventuales y sueldos, y los suma al total", async () => {
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadaUnaCompra(cuentaId, "2020-03-01T14:00:00-03:00", 3000);
    await dadoUnGasto(cuentaId, "2020-03-01T14:00:00-03:00", 4000);
    await dadoUnSueldo(50000, "2020-03-01");

    const stats = await cuandoSeConsultaElDashboard();

    expect(gastosDelDia(stats, "2020-03-01")).toEqual({
      fecha: "2020-03-01",
      repuestos: 3000,
      sueldos: 50000,
      eventuales: 4000,
    });
    expect(stats.totals?.gastos).toBe(57000);
  });
});

describe("Integration: dashboard - períodos", () => {
  it("un período que cruza meses devuelve un día por fila", async () => {
    await dadoUnArreglo({ fecha: "2020-02-25T10:00:00-03:00" });
    await dadoUnArreglo({ fecha: "2020-03-05T10:00:00-03:00" });

    const periodo = await cuandoSeConsultaElPeriodo("2020-02-20", "2020-03-10");

    // 20/02 al 29/02 (2020 es bisiesto) y 01/03 al 10/03
    expect(periodo.series.arreglos).toHaveLength(20);
    expect(periodo.series.arreglos[0].fecha).toBe("2020-02-20");
    expect(periodo.series.arreglos.at(-1)?.fecha).toBe("2020-03-10");
    expect(fechasConDatos(periodo.series.arreglos, (d) => d.cantidad)).toEqual({
      "2020-02-25": 1,
      "2020-03-05": 1,
    });
    expect(periodo.resumen.total).toBe(2);
  });

  it("el sueldo solo aparece en los días 1 incluidos en el período", async () => {
    await dadoUnSueldo(50000, "2020-02-01");

    const periodo = await cuandoSeConsultaElPeriodo("2020-02-20", "2020-03-10");

    expect(fechasConDatos(periodo.series.gastos, (d) => d.sueldos)).toEqual({ "2020-03-01": 50000 });
  });

  it("un período de más de 100 días sigue devolviendo un día por fila", async () => {
    const periodo = await cuandoSeConsultaElPeriodo("2020-01-01", "2020-06-30");

    expect(periodo.series.arreglos).toHaveLength(182);
    expect(periodo.series.ingresos).toHaveLength(182);
    expect(periodo.series.gastos).toHaveLength(182);
  });

  it("un rango invertido es rechazado por la base", async () => {
    await expect(
      arregloService.dashboardPeriodo(testClient, "2020-03-10T03:00:00.000Z", "2020-03-01T03:00:00.000Z")
    ).rejects.toThrow("Rango de fechas inválido");
  });
});
