import { describe, expect, it } from "vitest";
import {
  cuandoSeAsociaUnaFactura,
  dadaUnaConfiguracionFiscal,
  dadaUnaConfiguracionRemitos,
  configuracionRValida,
  dadaUnaFacturaAutorizadaConLineas,
  dadoUnRemitoEmitido,
  expectErrorDeNegocio,
  leerLineasRemito,
  leerRemito,
  lineaLibre,
} from "./remitosHelpers";

function sinVinculoFactura(linea: Record<string, unknown>) {
  const copia = { ...linea };
  delete copia.factura_linea_id;
  return copia;
}

async function dadoUnRemitoSinFactura(cantidades: number[], clase: "R" | "X" = "X") {
  const remitoId = await dadoUnRemitoEmitido({
    clase,
    lineas: cantidades.map((cantidad, index) => lineaLibre({ descripcion: `Ítem ${index + 1}`, cantidad })),
  });
  return { remitoId, lineas: await leerLineasRemito(remitoId) };
}

describe("Integration: asociación posterior de remitos a facturas (B2C-202)", () => {
  it("asocia un remito sin factura sin alterar numeración, fecha, CAI, snapshots ni ítems", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([2, 1], "R");
    const { facturaId, lineas: lineasFactura } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2 }, { cantidad: 1 }]);
    const antes = await leerRemito(remitoId);

    const { data, error } = await cuandoSeAsociaUnaFactura(remitoId, facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: lineasFactura[0].id },
      { remito_linea_id: lineas[1].id as string, factura_linea_id: lineasFactura[1].id },
    ]);

    expect(error).toBeNull();
    expect(data).toBe(remitoId);
    const despues = await leerRemito(remitoId);
    const { factura_id, factura_asociada_at, factura_asociada_by, ...restoDespues } = despues;
    const { factura_id: _f, factura_asociada_at: _a, factura_asociada_by: _b, ...restoAntes } = antes;
    expect(restoDespues).toEqual(restoAntes);
    expect(factura_id).toBe(facturaId);
    expect(factura_asociada_at).not.toBeNull();
    expect(factura_asociada_by).not.toBeNull();
    expect([_f, _a, _b]).toEqual([null, null, null]);

    const lineasDespues = await leerLineasRemito(remitoId);
    expect(lineasDespues.map(sinVinculoFactura)).toEqual(lineas.map(sinVinculoFactura));
    expect(lineasDespues.map((linea) => linea.factura_linea_id)).toEqual([lineasFactura[0].id, lineasFactura[1].id]);
  });

  it("rechaza una segunda asociación", async () => {
    await dadaUnaConfiguracionFiscal();
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([1]);
    const primera = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);
    const segunda = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);
    await cuandoSeAsociaUnaFactura(remitoId, primera.facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: primera.lineas[0].id },
    ]);

    const { error } = await cuandoSeAsociaUnaFactura(remitoId, segunda.facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: segunda.lineas[0].id },
    ]);

    expectErrorDeNegocio(error, "El remito ya está asociado a una factura");
    expect(error?.code).toBe("55000");
    expect((await leerRemito(remitoId)).factura_id).toBe(primera.facturaId);
  });

  it("rechaza la asociación que excede lo facturado considerando remitos previos", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5, descripcion: "Amortiguador" }]);
    await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 3 }] });
    await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 2 }] });
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([1]);

    const { error } = await cuandoSeAsociaUnaFactura(remitoId, facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: linea.id },
    ]);

    expectErrorDeNegocio(error, '"Amortiguador" supera la cantidad facturada disponible (0)');
    expect((await leerRemito(remitoId)).factura_id).toBeNull();
  });

  it("suma los ítems del mismo remito que apuntan a la misma línea", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 3 }]);
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([2, 2]);

    const { error } = await cuandoSeAsociaUnaFactura(remitoId, facturaId, lineas.map((item) => ({
      remito_linea_id: item.id as string,
      factura_linea_id: linea.id,
    })));

    expectErrorDeNegocio(error, "supera la cantidad facturada disponible (3)");
  });

  it("rechaza mapeos incompletos, duplicados o con líneas de otra factura", async () => {
    await dadaUnaConfiguracionFiscal();
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([1, 1]);
    const { facturaId, lineas: lineasFactura } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }, { cantidad: 5 }]);
    const otra = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);

    const incompleto = await cuandoSeAsociaUnaFactura(remitoId, facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: lineasFactura[0].id },
    ]);
    const duplicado = await cuandoSeAsociaUnaFactura(remitoId, facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: lineasFactura[0].id },
      { remito_linea_id: lineas[0].id as string, factura_linea_id: lineasFactura[1].id },
    ]);
    const ajena = await cuandoSeAsociaUnaFactura(remitoId, facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: lineasFactura[0].id },
      { remito_linea_id: lineas[1].id as string, factura_linea_id: otra.lineas[0].id },
    ]);

    expectErrorDeNegocio(incompleto.error, "Asociá todos los ítems del remito");
    expectErrorDeNegocio(duplicado.error, "una sola vez");
    expectErrorDeNegocio(ajena.error, "no pertenece a la factura");
    expect((await leerRemito(remitoId)).factura_id).toBeNull();
  });

  it("rechaza facturas no autorizadas", async () => {
    await dadaUnaConfiguracionFiscal();
    const { remitoId, lineas } = await dadoUnRemitoSinFactura([1]);
    const rechazada = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }], { estado: "RECHAZADA" });

    const { error } = await cuandoSeAsociaUnaFactura(remitoId, rechazada.facturaId, [
      { remito_linea_id: lineas[0].id as string, factura_linea_id: rechazada.lineas[0].id },
    ]);

    expectErrorDeNegocio(error, "Solo se pueden asociar facturas autorizadas");
  });

  it("no supera lo facturado con asociaciones simultáneas", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);
    const primero = await dadoUnRemitoSinFactura([3]);
    const segundo = await dadoUnRemitoSinFactura([3]);

    const resultados = await Promise.all([primero, segundo].map(({ remitoId, lineas }) => cuandoSeAsociaUnaFactura(
      remitoId,
      facturaId,
      [{ remito_linea_id: lineas[0].id as string, factura_linea_id: linea.id }],
    )));

    expect(resultados.filter((resultado) => resultado.error === null)).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.error !== null)).toHaveLength(1);
  });
});
