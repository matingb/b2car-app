import { describe, it, expect } from "vitest";
import { testClient } from "@/tests/integration";
import { eliminarRepuestoLineaViaRoute } from "../helpers/routeDrivers";
import { repuestosService } from "@/app/api/arreglos/repuestos/repuestosService";
import { operacionesService } from "@/app/api/operaciones/operacionesService";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import {
  dadoUnArregloConRepuesto,
  expectCantidadDeStock,
} from "../helpers/integrationFixtures";

describe("Integration (Route): DELETE /api/arreglos/[id]/repuestos/[lineaId]", () => {
  it("reintegra las unidades al stock y elimina la asignación vía API route", async () => {
    // Given: Un arreglo con 8 unidades asignadas de un stock original de 30 (stock actual = 22)
    const {
      arreglo,
      stockId,
      operacionId,
      lineaId,
      stockInicial,
      cantidadAsignada,
    } = await dadoUnArregloConRepuesto({
      stockInicial: 30,
      cantidadAsignada: 8,
      precioUnitario: 4500,
    });

    // Verificamos estado previo al borrado consultando el servicio
    await expectCantidadDeStock(stockId, stockInicial - cantidadAsignada); // 22

    // When: Se elimina la línea de asignación mediante la función encapsulada
    const res = await eliminarRepuestoLineaViaRoute(arreglo.id, lineaId);

    // Then: Status HTTP OK
    expect(res.status).toBe(200);

    // 1. El stock físico se reincorpora íntegramente (+8 -> 30) consultando el servicio de stock
    await expectCantidadDeStock(stockId, stockInicial);

    // 2. La línea de operaciones_lineas fue eliminada consultando el servicio de repuestos
    const { data: lineaDb } = await repuestosService.getOperacionLineaById(testClient, lineaId);
    expect(lineaDb).toBeNull();

    // 3. Al no quedar más líneas, la operación se eliminó consultando el servicio de operaciones
    const { data: operacionDb } = await operacionesService.getById(testClient, operacionId);
    expect(operacionDb).toBeNull();

    // 4. El vínculo con el arreglo se limpió consultando repuestosService y arregloCompletoService
    const { data: vinculoDb } = await repuestosService.getAsignacionByOperacionAndArreglo(
      testClient,
      { operacionId, arregloId: arreglo.id }
    );
    expect(vinculoDb).toBeNull();

    const { data: detalle } = await arregloCompletoService.getArregloDetalleCompleto(
      testClient,
      arreglo.id
    );
    expect(detalle?.asignaciones).toEqual([]);
  });
});
