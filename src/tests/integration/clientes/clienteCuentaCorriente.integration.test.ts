import { describe, it, expect } from "vitest";
import { testClient } from "@/tests/integration";
import { clienteFinanzasService } from "@/app/api/clientes/clienteFinanzasService";
import {
  dadoUnClienteParticularConVehiculo,
  dadoUnArreglo,
  dadoUnaCuentaFinanciera,
  cuandoSeCobraUnArreglo,
} from "../helpers/integrationFixtures";

describe("Integration: Cuenta Corriente del Cliente", () => {
  it("construye el libro mayor con cargos (débitos) y cobros (créditos) respetando saldo acumulado", async () => {
    // Given: Un cliente con un arreglo terminado de $90.000 y un cobro registrado de $35.000
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    const cuenta = await dadoUnaCuentaFinanciera({
      nombre: `Santander`,
      tipo: "CUENTA_BANCARIA",
    });

    const arreglo = await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 90000,
      descripcion: "Alineación y balanceo",
    });

    const detalleArreglo = await cuandoSeCobraUnArreglo(arreglo.id, {
      cuenta_financiera_id: cuenta.id,
      monto: 35000,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Anticipo transferencia",
    });
    const opCobroId = detalleArreglo?.cobros?.[0]?.operacion_id;

    // When: Se consulta la cuenta corriente del cliente mediante el servicio
    const { data: movimientos } = await clienteFinanzasService.getCuentaCorriente(
      testClient,
      cliente.id
    );

    // Then: Movimientos obtenidos exitosamente
    expect(movimientos).toBeDefined();
    expect(movimientos).toHaveLength(2);

    // 1. Validar movimiento de COBRO (crédito)
    const movCobro = movimientos!.find((m) => m.tipo_movimiento === "COBRO");
    expect(movCobro).toBeDefined();
    expect(Number(movCobro?.debito)).toBe(0);
    expect(Number(movCobro?.credito)).toBe(35000);
    expect(movCobro?.arreglo_id).toBe(arreglo.id);
    expect(opCobroId).toBeDefined();
    expect(movCobro?.operacion_id).toBe(opCobroId);
    expect(movCobro?.cuenta_nombre).toBe(cuenta.nombre);

    // 2. Validar movimiento de CARGO_ARREGLO (débito)
    const movCargo = movimientos!.find((m) => m.tipo_movimiento === "CARGO_ARREGLO");
    expect(movCargo).toBeDefined();
    expect(Number(movCargo?.debito)).toBe(90000);
    expect(Number(movCargo?.credito)).toBe(0);
    expect(movCargo?.arreglo_id).toBe(arreglo.id);
    expect(movCargo?.concepto).toContain("Alineación y balanceo");

    // 3. Saldo resultante deudor neto (débito 90.000 - crédito 35.000 = 55.000)
    const totalDebito = movimientos!.reduce((acc, m) => acc + Number(m.debito), 0);
    const totalCredito = movimientos!.reduce((acc, m) => acc + Number(m.credito), 0);
    expect(totalDebito - totalCredito).toBe(55000);
  });

  it("permite filtrar los movimientos de cuenta corriente por rango de fechas (from / to)", async () => {
    // Given: Un cliente con un arreglo registrado hoy
    const { cliente, vehiculo } = await dadoUnClienteParticularConVehiculo();
    await dadoUnArreglo({
      cliente_id: cliente.id,
      vehiculo_id: vehiculo.id,
      estado: "TERMINADO",
      precio_final: 45000,
      fecha: new Date().toISOString(),
    });

    // When: Consultamos el servicio con 'from' en el futuro (mañana)
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: movimientosFuturo, error: errFuturo } =
      await clienteFinanzasService.getCuentaCorriente(testClient, cliente.id, {
        from: manana,
      });

    // Then: No debe retornar movimientos fuera de rango
    expect(errFuturo).toBeNull();
    expect(movimientosFuturo).toEqual([]);

    // And When: Consultamos abarcando desde ayer hasta mañana
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: movimientosRango, error: errRango } =
      await clienteFinanzasService.getCuentaCorriente(testClient, cliente.id, {
        from: ayer,
        to: manana,
      });

    // Then: Retorna el movimiento del arreglo
    expect(errRango).toBeNull();
    expect(movimientosRango).toHaveLength(1);
    expect(Number(movimientosRango?.[0].debito)).toBe(45000);
  });
});
