import { describe, it, expect } from "vitest";
import { testClient, SEED } from "@/tests/integration";
import { asignarRepuestoViaRoute } from "../helpers/routeDrivers";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import {
  dadoUnArreglo,
  expectCantidadDeStock,
} from "../helpers/integrationFixtures";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

describe("Integration (Route): POST /api/arreglos/[id]/repuestos", () => {
  it("rechaza con status 400 cuando el stock es insuficiente y no se envían datos de compra", async () => {
    // Given: Un stock con solo 2 unidades disponibles y un arreglo en progreso
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 2, taller_id: SEED.tallerId },
    });
    const arreglo = await dadoUnArreglo({ estado: "EN_PROGRESO" });

    // When: Se invoca la API route intentando asignar 5 unidades sin datos de compra
    const res = await asignarRepuestoViaRoute(arreglo.id, {
      taller_id: SEED.tallerId,
      stock_id: stockId,
      cantidad: 5,
      monto_unitario: 7500,
    });

    // Then: La route responde 400
    expect(res.status).toBe(400);

    // Cantidad de stock inalterada consultando el servicio
    await expectCantidadDeStock(stockId, 2);

    // No se crearon asignaciones consultando el servicio del arreglo
    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arreglo.id
    );
    expect(detalle?.asignaciones).toEqual([]);
  });

  it("asigna con éxito: status 200, descuenta atómicamente el stock y genera la operación", async () => {
    // Given: Un stock con 20 unidades y un arreglo en progreso
    const { stockId } = await dadoQueExisteUnProductoConStock({
      stock: { cantidad: 20, taller_id: SEED.tallerId },
    });
    const arreglo = await dadoUnArreglo({
      estado: "EN_PROGRESO",
      precio_final: 30000,
    });

    // When: Se invoca la route asignando 6 unidades a $5.000 c/u
    const res = await asignarRepuestoViaRoute(arreglo.id, {
      taller_id: SEED.tallerId,
      stock_id: stockId,
      cantidad: 6,
      monto_unitario: 5000,
    });

    // Then: Status HTTP OK
    expect(res.status).toBe(200);

    // 1. Stock físico descontado de 20 a 14 consultando el servicio de stocks
    await expectCantidadDeStock(stockId, 14);

    // 2. Operación y línea de asignación registradas consultando el servicio del arreglo
    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arreglo.id
    );
    expect(detalle?.asignaciones).toHaveLength(1);

    const asignacion = detalle!.asignaciones[0];
    expect(asignacion.tipo).toBe("ASIGNACION_ARREGLO");
    expect(asignacion.taller_id).toBe(SEED.tallerId);
    expect(asignacion.lineas).toHaveLength(1);

    const linea = asignacion.lineas[0];
    expect(linea.stock_id).toBe(stockId);
    expect(linea.cantidad).toBe(6);
    expect(linea.delta_cantidad).toBe(-6);
    expect(Number(linea.monto_unitario)).toBe(5000);

    // 3. Verificamos la operación mediante operacionesService
    const { data: op } = await operacionesService.getById(testClient, asignacion.id);
    expect(op?.tipo).toBe("ASIGNACION_ARREGLO");
    expect(op?.taller_id).toBe(SEED.tallerId);
  });
});
