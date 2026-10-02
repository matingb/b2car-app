import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import {
  crearOperacionViaRoute,
  asignarRepuestoViaRoute,
} from "../helpers/routeDrivers";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import {
  dadoUnArreglo,
  dadoUnaCuentaFinanciera,
  expectCantidadDeStock,
  expectSaldoCuenta,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";
import { callPostArreglo } from "../arreglos/arreglosHelpers";
import { createCreateArregloRequest } from "@/tests/factories";

describe("Integration: Adquisición y asignación de repuestos a costo $0", () => {
  it("compra directa sin cargo: incrementa stock físico sin generar movimientos ni débitos en cuentas financieras", async () => {
    // Dado que el taller tiene una cuenta bancaria con saldo y un producto con stock existente
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 50000 });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 10, taller_id: SEED.tallerId },
    });

    // Cuando el encargado ingresa una compra de 5 unidades provistas sin cargo (costo 0) sin seleccionar cuenta
    const idempotencyKey = crypto.randomUUID();
    const res = await crearOperacionViaRoute({
      tipo: "COMPRA",
      taller_id: SEED.tallerId,
      idempotency_key: idempotencyKey,
      lineas: [
        {
          stock_id: stockId,
          cantidad: 5,
          monto_unitario: 0,
          delta_cantidad: 5,
        },
      ],
    });

    // Entonces la API route procesa la compra con status 201
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data?.id).toBeDefined();

    // 1. El stock físico en el taller aumenta de 10 a 15 unidades consultando el servicio
    await expectCantidadDeStock(stockId, 15);

    // 2. El saldo de la cuenta de tesorería del taller permanece intacto en $50.000 (sin débito contable)
    await expectSaldoCuenta(cuenta.id, 50000);

    // 3. La operación queda registrada como COMPRA en el histórico del sistema
    const { data: op } = await operacionesService.getById(testClient, body.data.id);
    expect(op?.tipo).toBe("COMPRA");
    expect(op?.taller_id).toBe(SEED.tallerId);
  });

  it("asignación con reposición sin costo: cubre stock faltante con compra a costo 0 sin tocar saldos bancarios", async () => {
    // Dado que el taller tiene solo 2 unidades de un repuesto, una cuenta con fondos y un arreglo en progreso que requiere 5 unidades
    const cuenta = await dadoUnaCuentaFinanciera({ saldoInicial: 80000 });
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 2, taller_id: SEED.tallerId },
    });
    const arreglo = await dadoUnArreglo({ estado: "EN_PROGRESO" });

    // Cuando el mecánico asigna 5 unidades al arreglo, indicando que el faltante (3 unidades) ingresa sin cargo (precio_compra = 0)
    const res = await asignarRepuestoViaRoute(arreglo.id, {
      taller_id: SEED.tallerId,
      stock_id: stockId,
      cantidad: 5,
      monto_unitario: 4500,
      precio_compra: 0,
    });

    // Entonces la API route responde con éxito (status 200)
    expect(res.status).toBe(200);

    // 1. El stock físico queda en 0 (2 iniciales + 3 ingresadas sin costo - 5 asignadas al vehículo)
    await expectCantidadDeStock(stockId, 0);

    // 2. No se produce ninguna deducción en la cuenta financiera
    await expectSaldoCuenta(cuenta.id, 80000);

    // 3. El arreglo registra la asignación de las 5 unidades con el valor acordado hacia el cliente
    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arreglo.id
    );
    expect(detalle?.asignaciones).toHaveLength(1);
    const linea = detalle!.asignaciones[0].lineas[0];
    expect(linea.stock_id).toBe(stockId);
    expect(linea.cantidad).toBe(5);
    expect(Number(linea.monto_unitario)).toBe(4500);
  });

  it("repuesto nuevo inline bonificado: crea catálogo y asigna al arreglo a costo $0 sin cuenta ni clave de idempotencia", async () => {
    // Dado un vehículo ingresado al taller con orden de arreglo en progreso
    const arreglo = await dadoUnArreglo({ estado: "EN_PROGRESO" });
    const stamp = Date.now().toString().slice(-6);
    const codigoRepuesto = `REP-BONIF-${stamp}`;

    // Cuando se da de alta un repuesto nuevo inline provisto por garantía comercial (costo 0, venta 3.500)
    const res = await asignarRepuestoViaRoute(arreglo.id, {
      tipo: "nuevo",
      taller_id: SEED.tallerId,
      codigo: codigoRepuesto,
      nombre: `Repuesto Bonificado ${stamp}`,
      precio_compra: 0,
      precio_venta: 3500,
      cantidad: 1,
    });

    // Entonces la asignación se completa exitosamente
    expect(res.status).toBe(200);

    // El arreglo refleja la nueva línea asignada
    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arreglo.id
    );
    expect(detalle?.asignaciones).toHaveLength(1);
    expect(detalle?.asignaciones[0].lineas).toHaveLength(1);
    const linea = detalle!.asignaciones[0].lineas[0];
    expect(Number(linea.monto_unitario)).toBe(3500);
  });

  it("presupuesto diferido sin costo: reserva repuestos a costo 0 sin materializar stock ni requerir cuenta previa", async () => {
    // Dado un stock disponible de 20 unidades en el taller
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 20, taller_id: SEED.tallerId },
    });

    // Cuando se emite un presupuesto para el cliente con un repuesto existente que ingresará sin cargo (costo 0)
    const res = await callPostArreglo(
      createCreateArregloRequest({
        vehiculo_id: SEED.vehiculoId,
        taller_id: SEED.tallerId,
        estado: "PRESUPUESTO",
        repuestos: [
          {
            stock_id: stockId,
            cantidad: 4,
            monto_unitario: 5000,
            precio_compra: 0,
          },
        ],
      })
    );

    // Entonces se genera el presupuesto sin exigir cuenta bancaria (status 201)
    expect(res.status).toBe(201);
    const body = await res.json();
    const arregloId = String(body.data?.id);

    // 1. El stock físico del taller permanece en 20 unidades (la asignación no se materializa en presupuesto)
    await expectCantidadDeStock(stockId, 20);

    // 2. El arreglo se almacena en estado PRESUPUESTO con el repuesto en estado pendiente
    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arregloId
    );
    expect(detalle?.arreglo.estado).toBe("PRESUPUESTO");
    expect(detalle?.arreglo.repuestos_pendientes).toHaveLength(1);
    expect(detalle?.asignaciones).toEqual([]);
  });
});
