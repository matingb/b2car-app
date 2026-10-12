import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { dadoUnArreglo } from "../helpers/integrationFixtures";
import {
  adminClient,
  cuandoSeEmiteUnRemito,
  dadaUnaConfiguracionFiscal,
  dadaUnaFacturaAutorizadaConLineas,
  dadaUnaOperacion,
  dadoUnRemitoEmitido,
  expectErrorDeNegocio,
  leerRemito,
} from "./remitosHelpers";

describe("Integration: remitos generados desde una venta", () => {
  it("guarda la venta de origen y admite varios remitos por venta", async () => {
    await dadaUnaConfiguracionFiscal();
    const operacionId = await dadaUnaOperacion();

    const primero = await dadoUnRemitoEmitido({ clase: "X", operacionId });
    const segundo = await dadoUnRemitoEmitido({ clase: "X", operacionId });

    expect(await leerRemito(primero)).toMatchObject({ operacion_id: operacionId, arreglo_id: null, factura_id: null });
    expect(await leerRemito(segundo)).toMatchObject({ operacion_id: operacionId });
  });

  it("asocia automáticamente la factura autorizada de la venta", async () => {
    await dadaUnaConfiguracionFiscal();
    const operacionId = await dadaUnaOperacion();
    const { facturaId } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2 }], { operacionId });

    const remitoId = await dadoUnRemitoEmitido({ clase: "X", operacionId });

    expect(await leerRemito(remitoId)).toMatchObject({ operacion_id: operacionId, factura_id: facturaId });
  });

  it("rechaza operaciones que no son ventas, facturas de otro origen y orígenes combinados", async () => {
    await dadaUnaConfiguracionFiscal();
    const compraId = await dadaUnaOperacion("COMPRA");
    const ventaId = await dadaUnaOperacion();
    const { facturaId: facturaDeArreglo } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }]);
    const arreglo = await dadoUnArreglo();

    expectErrorDeNegocio(
      (await cuandoSeEmiteUnRemito({ clase: "X", operacionId: compraId })).error,
      "Solo se pueden generar remitos desde operaciones de venta",
    );
    expectErrorDeNegocio(
      (await cuandoSeEmiteUnRemito({ clase: "X", operacionId: ventaId, facturaId: facturaDeArreglo })).error,
      "La factura no corresponde a la venta de origen",
    );
    expectErrorDeNegocio(
      (await cuandoSeEmiteUnRemito({ clase: "X", operacionId: ventaId, arregloId: arreglo.id })).error,
      "no desde ambos",
    );
    expectErrorDeNegocio(
      (await cuandoSeEmiteUnRemito({ clase: "X", operacionId: randomUUID() })).error,
      "Operación no encontrada",
    );
  });

  it("impide borrar una venta que tiene remitos", async () => {
    await dadaUnaConfiguracionFiscal();
    const operacionId = await dadaUnaOperacion();
    await dadoUnRemitoEmitido({ clase: "X", operacionId });

    const { error } = await adminClient.from("operaciones").delete().eq("id", operacionId);

    expect(error?.code).toBe("23503");
  });
});
