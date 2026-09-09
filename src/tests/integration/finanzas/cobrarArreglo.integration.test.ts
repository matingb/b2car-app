import { describe, it, expect } from "vitest";
import { testClient } from "@/tests/integration";
import { cobrarArregloViaRoute as cuandoSeCobraUnArreglo } from "../helpers/routeDrivers";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import {
  dadoUnaCuentaFinanciera,
  dadoUnArreglo,
  expectSaldoCuenta,
} from "../helpers/integrationFixtures";

describe("Integration (Route): POST /api/arreglos/[id]/cobro", () => {
  it("rechaza el cobro con status 400 si el arreglo está en estado PRESUPUESTO", async () => {
    // Given: Un presupuesto estimado de $50.000 y una cuenta financiera
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const presupuesto = await dadoUnArreglo({
      estado: "PRESUPUESTO",
      precio_final: 50000,
    });

    const res = await cuandoSeCobraUnArreglo(presupuesto.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 50000,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Intento de cobro en presupuesto",
    });

    // Then: La API route devuelve 400
    expect(res.status).toBe(400);

    // Saldo inalterado en cuenta consultando el servicio
    await expectSaldoCuenta(cuenta.id, 0);

    // El arreglo no fue modificado consultando el repositorio
    const { data: arregloDb } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      presupuesto.id
    );
    expect(Number(arregloDb?.total_cobrado)).toBe(0);
    expect(arregloDb?.esta_pago).toBe(false);
  });

  it("registra un pago parcial: status 200, actualiza saldo pendiente y acredita en cuenta financiera", async () => {
    // Given: Una cuenta con saldo $0 y un arreglo en progreso de $100.000
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const arreglo = await dadoUnArreglo({
      estado: "EN_PROGRESO",
      precio_final: 100000,
      total_cobrado: 0,
    });

    // When: Se registra un cobro parcial de $40.000
    const res = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 40000,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Cobro parcial adelanto",
    });

    // Then: Status HTTP OK
    expect(res.status).toBe(200);

    // Saldo en cuenta acreditado consultando el servicio
    await expectSaldoCuenta(cuenta.id, 40000);

    // Estado del arreglo persistido consultando el repositorio
    const { data: arregloDb } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(Number(arregloDb?.total_cobrado)).toBe(40000);
    expect(arregloDb?.esta_pago).toBe(false);
  });

  it("registra un pago total: status 200, marca el arreglo como pagado y cancela la deuda", async () => {
    // Given: Una cuenta financiera con saldo inicial $10.000 y un arreglo de $75.000
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 10000 });
    const arreglo = await dadoUnArreglo({
      estado: "TERMINADO",
      precio_final: 75000,
      total_cobrado: 0,
    });

    // When: Se registra el cobro total de $75.000
    const res = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 75000,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Pago total liquidación",
    });

    // Then: Status HTTP OK
    expect(res.status).toBe(200);

    // Saldo acumulado (10.000 inicial + 75.000 cobro) consultando el servicio
    await expectSaldoCuenta(cuenta.id, 85000);

    // Estado del arreglo marcado pagado consultando el repositorio
    const { data: arregloDb } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(Number(arregloDb?.total_cobrado)).toBe(75000);
    expect(arregloDb?.esta_pago).toBe(true);
  });

  it("mantiene idempotencia con idempotency_key sin duplicar saldo ni cobros", async () => {
    // Given: Una cuenta, un arreglo y una clave de idempotencia única
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const arreglo = await dadoUnArreglo({
      estado: "EN_PROGRESO",
      precio_final: 80000,
      total_cobrado: 0,
    });
    const idempotencyKey = crypto.randomUUID();

    // When: Primer cobro
    const res1 = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 30000,
      idempotency_key: idempotencyKey,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Cobro idempotente",
    });
    expect(res1.status).toBe(200);

    // And: Reintentamos con el mismo idempotency_key
    const res2 = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 30000,
      idempotency_key: idempotencyKey,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Cobro idempotente repetido",
    });
    expect(res2.status).toBe(200);

    // Then: Validamos contra servicios y repositorio que no se duplicó el cobro
    await expectSaldoCuenta(cuenta.id, 30000);

    const { data: arregloDb } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(Number(arregloDb?.total_cobrado)).toBe(30000);
    expect(arregloDb?.esta_pago).toBe(false);
  });
});
