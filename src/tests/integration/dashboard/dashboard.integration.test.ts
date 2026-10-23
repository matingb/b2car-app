import { describe, expect, it } from "vitest";
import { dadoUnArreglo, dadoUnArregloConRepuesto } from "../helpers/integrationFixtures";
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
} from "./dashboardHelpers";
import { testClient } from "@/tests/integration";
import { arregloService } from "@/app/api/arreglos/arregloService";

describe("Integration: dashboard", () => {
  it("dado una acción de cada tipo, al consultar el dashboard ubica cada operación en el timezone de Buenos Aires", async () => {
    const fecha = "2020-03-15T22:30:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();
    await dadoUnArreglo({ fecha });
    await dadaUnaVenta(cuentaId, fecha, 1500);
    await dadaUnaCompra(cuentaId, fecha, 800);
    await dadoUnGasto(cuentaId, fecha, 300);
    await dadoUnClienteCreadoEl(fecha);

    const stats = await cuandoSeConsultaElDashboard();
    const series = stats.periodo!.series;

    // Then: todo debe figurar el día 15, no el 16
    expect({
      arreglos: fechasConDatos(series.arreglos, (d) => d.cantidad),
      ventas: fechasConDatos(series.ingresos, (d) => d.ventas),
      compras: fechasConDatos(series.gastos, (d) => d.repuestos),
      gastosEventuales: fechasConDatos(series.gastos, (d) => d.eventuales),
      clientesNuevos: diasConDatos(clientesNuevosPorDia(stats), (d) => d.valor),
    }).toEqual({
      arreglos: { "2020-03-15": 1 },
      ventas: { "2020-03-15": 1500 },
      compras: { "2020-03-15": 800 },
      gastosEventuales: { "2020-03-15": 300 },
      clientesNuevos: { "15/03": 1 },
    });
  });

  it("dado ingresos de ingresos mano de obra, repuestos y ventas de mostrador en el mismo día, desglosa la facturación total para cada tipo ", async () => {
    const fecha = "2020-03-10T14:00:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();

    const { arreglo } = await dadoUnArregloConRepuesto({
      fecha,
      cantidadAsignada: 2,
      precioUnitario: 1500,
    });
    await dadaUnaManoDeObra(arreglo.id, 7000);
    await dadaUnaVenta(cuentaId, fecha, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    const ingresosDelDia = stats.periodo!.series.ingresos.find((d) => d.fecha === "2020-03-10");
    expect(ingresosDelDia).toEqual({
      fecha: "2020-03-10",
      mano_de_obra: 7000,
      repuestos: 3000,
      ventas: 4000,
    });
  });

  it("dado gastos de compras de repuestos, gastos eventuales y sueldos en el mismo día, desglosa el gasto total para cada tipo", async () => {
    const fecha = "2020-03-01T14:00:00-03:00";
    const cuentaId = await dadoUnaCuentaConSaldo();

    await dadaUnaCompra(cuentaId, fecha, 3000);
    await dadoUnGasto(cuentaId, fecha, 4000);
    await dadoUnSueldo(50000, fecha);

    const stats = await cuandoSeConsultaElDashboard();

    const gastosDelDia = stats.periodo!.series.gastos.find((d) => d.fecha === "2020-03-01");
    expect(gastosDelDia).toEqual({
      fecha: "2020-03-01",
      repuestos: 3000,
      sueldos: 50000,
      eventuales: 4000,
    });
    expect(stats.totals?.gastos).toBe(57000);
  });

  it("dado un período que cruza meses, devuelve un día por fila y el sueldo solo en los días 1 incluidos", async () => {
    await dadoUnSueldo(50000, "2020-02-01");
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
    expect(fechasConDatos(periodo.series.gastos, (d) => d.sueldos)).toEqual({ "2020-03-01": 50000 });
    expect(periodo.resumen.total).toBe(2);
  });

  it("dado un período de más de 100 días, no agrupa por semana ni por mes: sigue devolviendo un día por fila", async () => {
    const periodo = await cuandoSeConsultaElPeriodo("2020-01-01", "2020-06-30");

    expect(periodo.series.arreglos).toHaveLength(182);
    expect(periodo.series.ingresos).toHaveLength(182);
    expect(periodo.series.gastos).toHaveLength(182);
  });

  it("dado un rango invertido, la base lo rechaza", async () => {
    await expect(
      arregloService.dashboardPeriodo(testClient, "2020-03-10T03:00:00.000Z", "2020-03-01T03:00:00.000Z")
    ).rejects.toThrow("Rango de fechas inválido");
  });
});
