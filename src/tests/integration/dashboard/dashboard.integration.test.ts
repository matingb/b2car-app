import { describe, expect, it } from "vitest";
import { dadoUnArreglo, dadoUnArregloConRepuesto } from "../helpers/integrationFixtures";
import {
  clientesNuevosPorDia,
  cuandoSeConsultaElDashboard,
  dadaUnaCompra,
  dadaUnaManoDeObra,
  dadaUnaVenta,
  dadoUnClienteCreadoEl,
  dadoUnGasto,
  dadoUnSueldo,
  dadoUnaCuentaConSaldo,
  diasConDatos,
} from "./dashboardHelpers";

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

    // Then: todo debe figurar el día 15, no el 16
    expect({
      arreglos: diasConDatos(stats.arreglosPorPeriodo ?? [], (d) => d.cantidad),
      ventas: diasConDatos(stats.ingresosPorPeriodo ?? [], (d) => d.ventas),
      compras: diasConDatos(stats.gastosPorPeriodo ?? [], (d) => d.repuestos),
      gastosEventuales: diasConDatos(stats.gastosPorPeriodo ?? [], (d) => d.eventuales),
      clientesNuevos: diasConDatos(clientesNuevosPorDia(stats), (d) => d.valor),
    }).toEqual({
      arreglos: { "15": 1 },
      ventas: { "15": 1500 },
      compras: { "15": 800 },
      gastosEventuales: { "15": 300 },
      clientesNuevos: { "15/03": 1 },
    });
  });

  it("dado ingresos de ingresos mano de obra, repuestos y ventas de mostrador en el mismo día, desglosa la facturación total para cada tipo ", async () => {
    const dia = 10
    const fecha = `2020-03-${dia}T14:00:00-03:00`;
    const cuentaId = await dadoUnaCuentaConSaldo();

    const { arreglo } = await dadoUnArregloConRepuesto({
      fecha,
      cantidadAsignada: 2,
      precioUnitario: 1500,
    });
    await dadaUnaManoDeObra(arreglo.id, 7000);
    await dadaUnaVenta(cuentaId, fecha, 4000);

    const stats = await cuandoSeConsultaElDashboard();

    const ingresosDelDia = stats.ingresosPorPeriodo!.find((d) => d.label === dia.toString());
    expect(ingresosDelDia).toEqual({
      label: dia.toString(),
      mano_de_obra: 7000,
      repuestos: 3000,
      ventas: 4000,
    });
  });

  it("dado gastos de compras de repuestos, gastos eventuales y sueldos en el mismo día, desglosa el gasto total para cada tipo", async () => {
    const dia = "01";
    const fecha = `2020-03-${dia}T14:00:00-03:00`;
    const cuentaId = await dadoUnaCuentaConSaldo();

    await dadaUnaCompra(cuentaId, fecha, 3000);
    await dadoUnGasto(cuentaId, fecha, 4000);
    await dadoUnSueldo(50000, fecha);

    const stats = await cuandoSeConsultaElDashboard();

    const gastosDelDia = stats.gastosPorPeriodo!.find((d) => d.label === dia);
    expect(gastosDelDia).toEqual({
      label: dia,
      repuestos: 3000,
      sueldos: 50000,
      eventuales: 4000,
    });
  });
});


