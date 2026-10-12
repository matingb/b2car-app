import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createTestClient } from "@/tests/integration";
import { dadoUnArregloConRepuesto } from "@/tests/integration/helpers/integrationFixtures";
import {
  cuandoSeEmiteUnRemito,
  dadaUnaConfiguracionFiscal,
  dadaUnaFacturaAutorizadaConLineas,
  dadoOtroTenantConConfiguracionFiscal,
  dadoUnRemitoEmitido,
  cuandoSeAsociaUnaFactura,
  expectErrorDeNegocio,
  lineaLibre,
  leerLineasRemito,
  leerRemito,
} from "./remitosHelpers";

describe("Integration: remitos emitidos desde un arreglo o una factura (B2C-202)", () => {
  it("emite desde un arreglo y persiste el origen sin crear una factura", async () => {
    await dadaUnaConfiguracionFiscal();
    const { arreglo } = await dadoUnArregloConRepuesto({ cantidadAsignada: 2 });

    const remitoId = await dadoUnRemitoEmitido({
      clase: "X",
      arregloId: arreglo.id,
      lineas: [lineaLibre({ codigo: "REP-1", descripcion: "Pastillas de freno", cantidad: 2 })],
    });

    expect(await leerRemito(remitoId)).toMatchObject({
      arreglo_id: arreglo.id,
      factura_id: null,
    });
    expect(await leerLineasRemito(remitoId)).toMatchObject([
      { codigo: "REP-1", descripcion: "Pastillas de freno", cantidad: 2 },
    ]);
  });

  it("asocia automáticamente la factura autorizada del arreglo y conserva ambos vínculos al reintentar", async () => {
    await dadaUnaConfiguracionFiscal();
    const { arreglo } = await dadoUnArregloConRepuesto({ cantidadAsignada: 3 });
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas(
      [{ cantidad: 3, descripcion: "Pastillas" }], { arregloId: arreglo.id },
    );
    const idempotencyKey = randomUUID();
    const args = { clase: "X" as const, arregloId: arreglo.id, idempotencyKey, lineas: [{ factura_linea_id: linea.id, cantidad: 2 }] };

    const remitoId = await dadoUnRemitoEmitido(args);
    const retry = await cuandoSeEmiteUnRemito(args);

    expect(retry.error).toBeNull();
    expect(retry.data).toBe(remitoId);
    expect(await leerRemito(remitoId)).toMatchObject({ arreglo_id: arreglo.id, factura_id: facturaId });
    expect((await leerRemito(remitoId)).factura_asociada_at).not.toBeNull();
    expect(await leerLineasRemito(remitoId)).toMatchObject([{ factura_linea_id: linea.id, cantidad: 2 }]);
    const exceso = await cuandoSeEmiteUnRemito({ ...args, idempotencyKey: randomUUID() });
    expectErrorDeNegocio(exceso.error, "supera la cantidad facturada disponible");
  });

  it("acepta la factura explícita del arreglo y rechaza una factura de otro arreglo", async () => {
    await dadaUnaConfiguracionFiscal();
    const { arreglo } = await dadoUnArregloConRepuesto({ cantidadAsignada: 2 });
    const propia = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2 }], { arregloId: arreglo.id });
    const ajena = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2 }]);

    const remitoId = await dadoUnRemitoEmitido({
      clase: "X", arregloId: arreglo.id, facturaId: propia.facturaId,
      lineas: [{ factura_linea_id: propia.lineas[0].id, cantidad: 1 }],
    });
    expect(await leerRemito(remitoId)).toMatchObject({ arreglo_id: arreglo.id, factura_id: propia.facturaId });
    const result = await cuandoSeEmiteUnRemito({
      clase: "X", arregloId: arreglo.id, facturaId: ajena.facturaId,
      lineas: [{ factura_linea_id: ajena.lineas[0].id, cantidad: 1 }],
    });
    expectErrorDeNegocio(result.error, "no corresponde al arreglo de origen");
  });

  it("admite entregas parciales y sucesivas hasta la cantidad facturada", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5, descripcion: "Filtro de aceite" }]);

    const primero = await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 3 }] });
    const segundo = await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 2 }] });
    const tercero = await cuandoSeEmiteUnRemito({ clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 1 }] });

    expectErrorDeNegocio(tercero.error, 'La cantidad a remitir de "Filtro de aceite" supera la cantidad facturada disponible (0)');
    for (const remitoId of [primero, segundo]) {
      const remito = await leerRemito(remitoId);
      expect(remito.factura_id).toBe(facturaId);
      expect(remito.factura_asociada_at).not.toBeNull();
    }
    const [lineaRemito] = await leerLineasRemito(primero);
    expect(lineaRemito).toMatchObject({
      factura_linea_id: linea.id,
      descripcion: "Filtro de aceite",
      codigo: "REP-1",
    });
    expect(Number(lineaRemito.cantidad)).toBe(3);
  });

  it("persiste código y descripción propios del remito sin modificar la factura", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2, codigo: "BAT-1", descripcion: "Batería 12V" }]);

    const remitoId = await dadoUnRemitoEmitido({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: linea.id, cantidad: 1, codigo: "OTRO", descripcion: "Otro texto", observaciones: "Caja sellada" }],
    });

    const [lineaRemito] = await leerLineasRemito(remitoId);
    expect(lineaRemito).toMatchObject({ codigo: "OTRO", descripcion: "Otro texto", observaciones: "Caja sellada" });
  });

  it("rechaza líneas ajenas a la factura y permite ítems libres junto a conceptos vinculados", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [propia] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);
    const { lineas: [ajena] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);

    const lineaAjena = await cuandoSeEmiteUnRemito({ clase: "X", facturaId, lineas: [{ factura_linea_id: ajena.id, cantidad: 1 }] });
    const mixto = await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [
      { factura_linea_id: propia.id, cantidad: 2 },
      { descripcion: propia.descripcion, cantidad: 100 },
    ] });

    expectErrorDeNegocio(lineaAjena.error, "no corresponde a una línea de la factura");
    expect(await leerRemito(mixto)).toMatchObject({ factura_id: facturaId });
    expect(await leerLineasRemito(mixto)).toMatchObject([
      { factura_linea_id: propia.id, cantidad: 2 },
      { factura_linea_id: null, cantidad: 100 },
    ]);
    await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: propia.id, cantidad: 3 }] });
    const exceso = await cuandoSeEmiteUnRemito({ clase: "X", facturaId, lineas: [{ factura_linea_id: propia.id, cantidad: 1 }] });
    expectErrorDeNegocio(exceso.error, "supera la cantidad facturada disponible");
  });

  it("permite separar varios ítems y asociarlos a una misma línea sin superar el acumulado", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 3, descripcion: "Repuestos" }]);
    const remitoId = await dadoUnRemitoEmitido({
      clase: "X",
      lineas: [
        lineaLibre({ codigo: "CAJA-1", descripcion: "Caja 1", cantidad: 2 }),
        lineaLibre({ codigo: "CAJA-2", descripcion: "Caja 2", cantidad: 1 }),
      ],
    });
    const lineasRemito = await leerLineasRemito(remitoId);

    const asociado = await cuandoSeAsociaUnaFactura(remitoId, facturaId, lineasRemito.map((item) => ({
      remito_linea_id: String(item.id),
      factura_linea_id: linea.id,
    })));
    expect(asociado.error).toBeNull();
    expect((await leerLineasRemito(remitoId)).map((item) => item.factura_linea_id)).toEqual([linea.id, linea.id]);

    const excedido = await cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: linea.id, cantidad: 0.1 }],
    });
    expectErrorDeNegocio(excedido.error, 'La cantidad a remitir de "Repuestos" supera la cantidad facturada disponible (0)');
  });

  it("rechaza facturas no autorizadas, notas de crédito y facturas de otro ambiente", async () => {
    await dadaUnaConfiguracionFiscal();
    const rechazada = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }], { estado: "RECHAZADA" });
    const incierta = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }], { estado: "INCIERTA" });
    const produccion = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }], { ambiente: "PRODUCCION" });
    const original = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }]);
    const notaCredito = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 1 }], {
      documentoTipo: "NOTA_CREDITO",
      documentoAsociadoId: original.facturaId,
    });

    for (const factura of [rechazada, incierta, notaCredito]) {
      const { error } = await cuandoSeEmiteUnRemito({
        clase: "X",
        facturaId: factura.facturaId,
        lineas: [{ factura_linea_id: factura.lineas[0].id, cantidad: 1 }],
      });
      expectErrorDeNegocio(error, "Solo se pueden generar remitos desde facturas autorizadas");
    }
    const { error: otroAmbiente } = await cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId: produccion.facturaId,
      lineas: [{ factura_linea_id: produccion.lineas[0].id, cantidad: 1 }],
    });
    expectErrorDeNegocio(otroAmbiente, "otro ambiente fiscal");
    const { error: inexistente } = await cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId: randomUUID(),
      lineas: [{ factura_linea_id: randomUUID(), cantidad: 1 }],
    });
    expectErrorDeNegocio(inexistente, "Factura no encontrada");
  });

  it("no permite remitir facturas de otro tenant", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 3 }]);
    const otroTenant = createTestClient({ tenantId: await dadoOtroTenantConConfiguracionFiscal() });

    const { error } = await cuandoSeEmiteUnRemito(
      { clase: "X", facturaId, lineas: [{ factura_linea_id: linea.id, cantidad: 1 }] },
      otroTenant,
    );

    expectErrorDeNegocio(error, "Factura no encontrada");
  });

  it("permite varios remitos por factura con líneas distintas y controla cada línea por separado", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [repuesto, servicio] } = await dadaUnaFacturaAutorizadaConLineas([
      { cantidad: 4, descripcion: "Pastillas de freno" },
      { cantidad: 1, descripcion: "Mano de obra", origen: "SERVICIO" },
    ]);

    await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: repuesto.id, cantidad: 4 }] });
    await dadoUnRemitoEmitido({ clase: "X", facturaId, lineas: [{ factura_linea_id: servicio.id, cantidad: 1 }] });
    const excedido = await cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: repuesto.id, cantidad: 0.5 }],
    });

    expectErrorDeNegocio(excedido.error, '"Pastillas de freno" supera la cantidad facturada disponible (0)');
  });

  it("no supera lo facturado con emisiones simultáneas sobre la misma línea", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);

    const resultados = await Promise.all([3, 3].map((cantidad) => cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: linea.id, cantidad }],
    })));

    expect(resultados.filter((resultado) => resultado.error === null)).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.error !== null)).toHaveLength(1);
  });
});
