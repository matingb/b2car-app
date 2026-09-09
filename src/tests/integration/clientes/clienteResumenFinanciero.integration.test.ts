import { describe, it, expect } from "vitest";
import { testClient } from "@/tests/integration";
import { clienteFinanzasService } from "@/app/api/clientes/clienteFinanzasService";
import {
  dadoUnClienteParticularConVehiculo,
  dadoUnArreglo,
  dadoUnaFacturaAutorizadaParaArreglo,
} from "../helpers/integrationFixtures";

describe("Integration: Resumen Financiero del Cliente", () => {
  it("calcula deuda total segregando correctamente arreglos no facturables y presupuestos", async () => {
    // Given: Un cliente con:
    // - Arreglo 1 Facturable: $100.000 (adeudado)
    // - Arreglo 2 No Facturable: $50.000 (adeudado)
    // - Arreglo 3 Presupuesto: $30.000
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();

    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 100000,
      es_facturable: true,
      esta_pago: false,
    });

    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 50000,
      es_facturable: false,
      esta_pago: false,
    });

    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "PRESUPUESTO",
      precio_final: 30000,
      es_facturable: true,
      esta_pago: false,
    });

    const { data: resumen } = await clienteFinanzasService.getResumenFinanciero(
      testClient,
      cliente.id
    );

    // Then:
    // 1. La deuda en cuenta corriente es $150.000 (suma de facturable + no facturable, excluye presupuesto)
    expect(Number(resumen?.saldo_cuenta)).toBe(150000);
    // 2. El saldo a facturar es sólo $100.000 (excluye el no facturable y el presupuesto)
    expect(Number(resumen?.saldo_a_facturar)).toBe(100000);
  });

  it("descuenta del saldo a facturar cuando se emite una factura electrónica autorizada manteniendo la deuda", async () => {
    // Given: Un cliente con un arreglo facturable de $80.000 y uno no facturable de $20.000
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();

    const arregloFacturable = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 80000,
      es_facturable: true,
      esta_pago: false,
    });

    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 20000,
      es_facturable: false,
      esta_pago: false,
    });

    await dadoUnaFacturaAutorizadaParaArreglo(arregloFacturable.id);

    // Then: El servicio actualiza el saldo a facturar a $0 mientras que la deuda se mantiene en $100.000
    const { data: resumenFinanciero } = await clienteFinanzasService.getResumenFinanciero(
      testClient,
      cliente.id
    );

    expect(Number(resumenFinanciero?.saldo_a_facturar)).toBe(0);
    expect(resumenFinanciero?.cantidad_arreglos_pendientes_factura).toBe(0);
    expect(Number(resumenFinanciero?.saldo_cuenta)).toBe(100000);
    expect(resumenFinanciero?.cantidad_arreglos_pendientes_pago).toBe(2);
  });
});
