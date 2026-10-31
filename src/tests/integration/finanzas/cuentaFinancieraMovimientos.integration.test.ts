import { describe, expect, it } from "vitest";
import {
  cuandoSeCobraUnArreglo,
  dadoUnArreglo,
  dadoUnArregloConRepuesto,
  dadoUnaCuentaFinanciera,
  expectSaldoCuenta,
} from "../helpers/integrationFixtures";
import {
  anularCobroArregloViaRoute,
  borrarArregloViaRoute,
  eliminarRepuestoLineaViaRoute,
  getCuentaMovimientosViaRoute,
} from "../helpers/routeDrivers";
import {
  cuandoSeBorraLaOperacion,
  dadaUnaCompra,
  dadaUnaVenta,
  dadoUnGasto,
  dadoUnSueldo,
} from "../dashboard/dashboardHelpers";

/**
 * Harness de cuentas financieras: cada acción debe mover el saldo y dejar su
 * asiento en el libro de movimientos; su reversión debe volver el saldo al
 * inicial dejando asiento + contraasiento (el libro es inmutable).
 */

const FECHA = "2020-03-10T14:00:00-03:00";
const SALDO_INICIAL = 1000;

const dadaUnaCuenta = () => dadoUnaCuentaFinanciera({ saldoInicial: SALDO_INICIAL });

/** Importes del libro posteriores al saldo inicial, del más antiguo al más reciente. */
async function importesDelLibro(cuentaId: string): Promise<number[]> {
  const res = await getCuentaMovimientosViaRoute(cuentaId);
  const body = (await res.json()) as { data: { importe: number; createdAt: string }[] };
  const asientos = body.data
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => m.importe);
  expect(asientos[0]).toBe(SALDO_INICIAL); // asiento de apertura
  return asientos.slice(1);
}

describe("Integration: cuentas financieras - ventas", () => {
  it("una venta cobrada acredita el importe en la cuenta y deja un asiento", async () => {
    const cuenta = await dadaUnaCuenta();

    await dadaUnaVenta(cuenta.id, FECHA, 1500);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 1500);
    expect(await importesDelLibro(cuenta.id)).toEqual([1500]);
  });

  it("al borrar la venta, el saldo vuelve al inicial con un contraasiento", async () => {
    const cuenta = await dadaUnaCuenta();
    const ventaId = await dadaUnaVenta(cuenta.id, FECHA, 1500);

    await cuandoSeBorraLaOperacion(ventaId);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([1500, -1500]);
  });
});

describe("Integration: cuentas financieras - compras", () => {
  it("una compra pagada debita el importe de la cuenta y deja un asiento", async () => {
    const cuenta = await dadaUnaCuenta();

    await dadaUnaCompra(cuenta.id, FECHA, 800);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL - 800);
    expect(await importesDelLibro(cuenta.id)).toEqual([-800]);
  });

  it("al borrar la compra, el saldo vuelve al inicial con un contraasiento", async () => {
    const cuenta = await dadaUnaCuenta();
    const compraId = await dadaUnaCompra(cuenta.id, FECHA, 800);

    await cuandoSeBorraLaOperacion(compraId);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([-800, 800]);
  });
});

describe("Integration: cuentas financieras - gastos", () => {
  it("un gasto debita el importe de la cuenta y deja un asiento", async () => {
    const cuenta = await dadaUnaCuenta();

    await dadoUnGasto(cuenta.id, FECHA, 300);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL - 300);
    expect(await importesDelLibro(cuenta.id)).toEqual([-300]);
  });

  it("al borrar el gasto, el saldo vuelve al inicial con un contraasiento", async () => {
    const cuenta = await dadaUnaCuenta();
    const gastoId = await dadoUnGasto(cuenta.id, FECHA, 300);

    await cuandoSeBorraLaOperacion(gastoId);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([-300, 300]);
  });
});

describe("Integration: cuentas financieras - arreglos", () => {
  it("el cobro de un arreglo acredita el monto cobrado en la cuenta", async () => {
    const cuenta = await dadaUnaCuenta();
    const arreglo = await dadoUnArreglo({ estado: "EN_PROGRESO", precio_final: 5000 });

    await cuandoSeCobraUnArreglo(arreglo.id, { cuenta_financiera_id: cuenta.id, monto: 2000 });

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL + 2000);
    expect(await importesDelLibro(cuenta.id)).toEqual([2000]);
  });

  it("al anular el cobro, el saldo vuelve al inicial", async () => {
    const cuenta = await dadaUnaCuenta();
    const arreglo = await dadoUnArreglo({ estado: "EN_PROGRESO", precio_final: 5000 });
    const detalle = await cuandoSeCobraUnArreglo(arreglo.id, { cuenta_financiera_id: cuenta.id, monto: 2000 });

    await anularCobroArregloViaRoute(arreglo.id, detalle?.cobros?.[0]?.operacion_id ?? "");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
  });

  it("crear o borrar un arreglo sin cobros no mueve la cuenta", async () => {
    const cuenta = await dadaUnaCuenta();
    const arreglo = await dadoUnArreglo({ precio_final: 5000 });

    await borrarArregloViaRoute(arreglo.id);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([]);
  });
});

describe("Integration: cuentas financieras - repuestos y sueldos", () => {
  it("asignar o quitar un repuesto de un arreglo no mueve la cuenta", async () => {
    const cuenta = await dadaUnaCuenta();
    const { arreglo, lineaId } = await dadoUnArregloConRepuesto({ cantidadAsignada: 2, precioUnitario: 1500 });

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    await eliminarRepuestoLineaViaRoute(arreglo.id, lineaId);

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([]);
  });

  it("los sueldos son un gasto calculado y no mueven la cuenta", async () => {
    const cuenta = await dadaUnaCuenta();

    await dadoUnSueldo(50000, "2020-03-01");

    await expectSaldoCuenta(cuenta.id, SALDO_INICIAL);
    expect(await importesDelLibro(cuenta.id)).toEqual([]);
  });
});
