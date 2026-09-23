import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/arreglos/route";
import { PUT } from "@/app/api/arreglos/[id]/route";
import { arregloCompletoService } from "@/app/api/arreglos/arregloCompletoService";
import { stocksService } from "@/app/api/stocks/stocksService";
import { testClient, SEED } from "@/tests/integration";
import { createCreateArregloRequest } from "@/tests/factories";
import { dadoQueExisteUnProductoConStock } from "../helpers/stockHelpers";

async function crearPresupuesto(cantidad: number, stockId: string) {
  const response = await POST(
    new Request("http://localhost:3000/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createCreateArregloRequest({
          vehiculo_id: SEED.vehiculoId,
          taller_id: SEED.tallerId,
          estado: "PRESUPUESTO",
          repuestos: [
            {
              stock_id: stockId,
              cantidad,
              monto_unitario: SEED.stockAceite.precioUnitario,
            },
          ],
        })
      ),
    })
  );
  expect(response.status).toBe(201);
  const body = await response.json();
  return String(body.data.id);
}

async function activar(arregloId: string) {
  return PUT(
    new Request(`http://localhost:3000/api/arreglos/${arregloId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "EN_PROGRESO" }),
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: arregloId }) }
  );
}

describe("Integration - Presupuestos diferidos B2C-152", () => {
  it("no materializa stock al crear y activa una sola vez", async () => {
    const { stockId } = await dadoQueExisteUnProductoConStock({ stock: { cantidad: 200 } });
    const { data: stockBefore } = await stocksService.getById(testClient, stockId);
    const arregloId = await crearPresupuesto(3, stockId);

    const { data: budget } = await arregloCompletoService.getArregloDetalleCompleto(testClient, arregloId);
    expect(budget?.arreglo.estado).toBe("PRESUPUESTO");
    expect(budget?.arreglo.repuestos_pendientes).toHaveLength(1);
    expect(budget?.asignaciones).toEqual([]);
    expect(Number(budget?.arreglo.precio_final)).toBe(3 * SEED.stockAceite.precioUnitario);
    expect(stockBefore?.cantidad).toBe(SEED.stockAceite.cantidadInicial);

    const activation = await activar(arregloId);
    expect(activation.status, JSON.stringify(await activation.clone().json())).toBe(200);

    const { data: active } = await arregloCompletoService.getArregloDetalleCompleto(testClient, arregloId);
    const { data: stockAfter } = await stocksService.getById(testClient, stockId);
    expect(active?.arreglo.estado).toBe("EN_PROGRESO");
    expect(active?.arreglo.repuestos_pendientes).toBeNull();
    expect(active?.asignaciones).toHaveLength(1);
    expect(Number(active?.arreglo.precio_final)).toBe(3 * SEED.stockAceite.precioUnitario);
    expect(stockAfter?.cantidad).toBe(SEED.stockAceite.cantidadInicial - 3);

    const { data: retry, error: retryError } = await testClient.rpc("rpc_activar_presupuesto", {
      p_arreglo_id: arregloId,
      p_nuevo_estado: "EN_PROGRESO",
    });
    expect(retryError).toBeNull();
    expect(retry).toBe(true);
    const { data: stockAfterRetry } = await stocksService.getById(testClient, stockId);
    expect(stockAfterRetry?.cantidad).toBe(SEED.stockAceite.cantidadInicial - 3);
  });

  it("revierte toda la activacion si falta precio de compra", async () => {
    const { stockId } = await dadoQueExisteUnProductoConStock({ stock: { cantidad: 200 } });
    const { data: stockBefore } = await stocksService.getById(testClient, stockId);
    const arregloId = await crearPresupuesto(201, stockId);

    const activation = await activar(arregloId);
    expect(activation.status, JSON.stringify(await activation.clone().json())).toBe(400);

    const { data: budget } = await arregloCompletoService.getArregloDetalleCompleto(testClient, arregloId);
    const { data: stockAfter } = await stocksService.getById(testClient, stockId);
    expect(budget?.arreglo.estado).toBe("PRESUPUESTO");
    expect(budget?.arreglo.repuestos_pendientes).toHaveLength(1);
    expect(budget?.asignaciones).toEqual([]);
    expect(Number(budget?.arreglo.precio_final)).toBe(201 * SEED.stockAceite.precioUnitario);
    expect(stockAfter?.cantidad).toBe(stockBefore?.cantidad);
  });
});
