import { describe, it, expect, assert } from "vitest";
import { testClient } from "@/tests/integration";
import { anularCobroArregloViaRoute } from "../helpers/routeDrivers";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import {
  dadoUnArregloCobrado,
  expectSaldoCuenta,
  dadoUnaCuentaFinanciera,
  dadoUnArreglo,
  cuandoSeCobraUnArreglo,
} from "../helpers/integrationFixtures";

describe("Integration - Anular Cobro", () => {
  it("anula un cobro total y revierte el saldo de la cuenta reabriendo la deuda", async () => {
    const { arreglo, cuentaId, operacionId } = await dadoUnArregloCobrado({
      precioFinal: 100000,
      montoCobrado: 100000,
    });

    await expectSaldoCuenta(cuentaId, 100000);

    // When: Se anula el cobro
    await anularCobroArregloViaRoute(arreglo.id, operacionId);

    // Then:
    // El saldo de la cuenta financiera se revierte
    await expectSaldoCuenta(cuentaId, 0);

    // El arreglo reabre su deuda
    const { data: arregloActualizado } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    assert(arregloActualizado);
    expect(arregloActualizado.total_cobrado).toBe(0);
    expect(arregloActualizado.esta_pago).toBe(false);

    // La operación financiera ya no figura como movimiento activo
    const { data: operacion } = await operacionesService.getById(testClient, operacionId);
    expect(operacion).toBeNull();
  });

  it("anula selectivamente un cobro específico entre múltiples cobros parciales", async () => {
    // Given: Una cuenta y un arreglo con dos cobros registrados
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 0 });
    const arreglo = await dadoUnArreglo({
      estado: "EN_PROGRESO",
      precio_final: 100000,
      total_cobrado: 0,
    });

    // Cobro 1
    const detalle1 = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 30000,
      descripcion: "Primer pago parcial",
    });
    const cobro1Id = detalle1?.cobros?.[0]?.operacion_id ?? "";

    // Cobro 2
    const detalle2 = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 20000,
      descripcion: "Segundo pago parcial",
    });
    const cobro2Item = detalle2?.cobros?.find((c) => c.operacion_id !== cobro1Id);
    const cobro2Id = cobro2Item?.operacion_id ?? "";

    // Verificamos estado previo
    await expectSaldoCuenta(cuenta.id, 50000);

    // When
    await anularCobroArregloViaRoute(arreglo.id, cobro2Id);

    // Then:
    // Saldo en cuenta se reduce
    await expectSaldoCuenta(cuenta.id, 30000);

    // El arreglo refleja el nuevo total cobrado
    const { data: arregloDb } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(Number(arregloDb?.total_cobrado)).toBe(30000);
    expect(arregloDb?.esta_pago).toBe(false);

    // Cobro 1 permanece activo
    const { data: operacion1 } = await operacionesService.getById(testClient, cobro1Id);
    expect(operacion1).not.toBeNull();

    // Cobro 2 fue eliminado
    const { data: operacion2 } = await operacionesService.getById(testClient, cobro2Id);
    expect(operacion2).toBeNull();
  });
});
