import { describe, it, expect } from "vitest";
import { testClient } from "@/tests/integration";
import { borrarArregloViaRoute as cuandoSeBorraUnArreglo } from "../helpers/routeDrivers";
import { supabaseArregloRepository } from "@/app/api/arreglos/arregloRepository";
import {
  dadoUnArreglo,
  dadoUnArregloCobrado,
  dadoUnArregloConRepuesto,
  dadoUnaFacturaAutorizadaParaArreglo,
  expectCantidadDeStock,
  expectSaldoCuenta,
} from "../helpers/integrationFixtures";

describe("Integration: Borrado de Arreglo ", () => {
  it("elimina un arreglo simple sin repuestos ni cobros", async () => {
    // Given
    const arreglo = await dadoUnArreglo({
      descripcion: "Arreglo simple para borrado",
      precio_final: 25000,
    });

    // When
    await cuandoSeBorraUnArreglo(arreglo.id);

    // Then
    const { data: buscado } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(buscado).toBeNull();
  });

  it("restituye automáticamente el stock al inventario al borrar un arreglo con repuestos asignados", async () => {
    const { arreglo, stockId, stockInicial, cantidadAsignada } =
      await dadoUnArregloConRepuesto({
        stockInicial: 30,
        cantidadAsignada: 5,
        precioUnitario: 8000,
      });

    // When: Se elimina el arreglo
    await cuandoSeBorraUnArreglo(arreglo.id);

    // Then:
    await expectCantidadDeStock(stockId, stockInicial);

    // Las asignaciones del arreglo en operaciones_asignacion_arreglo fueron eliminadas
    const { data: asignaciones } = await testClient
      .from("operaciones_asignacion_arreglo")
      .select("operacion_id")
      .eq("arreglo_id", arreglo.id);
    expect(asignaciones).toHaveLength(0);
  });

  it("anula cobros y revierte saldos bancarios al borrar un arreglo cobrado", async () => {
    const montoCobrado = 50000;
    const { arreglo, cuentaId } = await dadoUnArregloCobrado({
      precioFinal: 100000,
      montoCobrado,
    });

    // When: Se elimina el arreglo
    await cuandoSeBorraUnArreglo(arreglo.id);

    // Then:
    // El saldo de la cuenta se restituye a $0
    await expectSaldoCuenta(cuentaId, 0);
  });

  it("bloquea el borrado si el arreglo posee una factura electrónica autorizada (protección fiscal)", async () => {
    const arreglo = await dadoUnArreglo({
      descripcion: "Arreglo facturado con CAE",
      precio_final: 75000,
    });

    await dadoUnaFacturaAutorizadaParaArreglo(arreglo.id);

    // When
    const res = await cuandoSeBorraUnArreglo(arreglo.id);
    const json = await res.json();

    // Then: La API rechaza la eliminación con error de servidor
    expect(res.status).toBe(409);
    expect(json.error).toBe("El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar");

    const { data: arregloExistente } = await supabaseArregloRepository.getByIdWithVehiculo(
      testClient,
      arreglo.id
    );
    expect(arregloExistente).not.toBeNull();

    // Verificamos que la RPC de base de datos exponga el código de error 55001
    const { error: rpcError } = await testClient.rpc("rpc_borrar_arreglo", {
      p_arreglo_id: arreglo.id,
    });
    expect(rpcError?.code).toBe("55001");
  });
});
