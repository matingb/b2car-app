import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createTestClient } from "@/tests/integration";
import {
  cuandoSeEmiteUnRemito,
  dadaUnaConfiguracionFiscal,
  dadaUnaFacturaAutorizadaConLineas,
  dadoOtroTenantConConfiguracionFiscal,
  dadoUnRemitoEmitido,
  expectErrorDeNegocio,
  leerLineasRemito,
  leerRemito,
} from "./remitosHelpers";

describe("Integration: remitos emitidos desde una factura (B2C-202)", () => {
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

  it("copia código y descripción desde la factura e ignora los enviados por el usuario", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 2, codigo: "BAT-1", descripcion: "Batería 12V" }]);

    const remitoId = await dadoUnRemitoEmitido({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: linea.id, cantidad: 1, codigo: "OTRO", descripcion: "Otro texto", observaciones: "Caja sellada" }],
    });

    const [lineaRemito] = await leerLineasRemito(remitoId);
    expect(lineaRemito).toMatchObject({ codigo: "BAT-1", descripcion: "Batería 12V", observaciones: "Caja sellada" });
  });

  it("rechaza líneas ajenas a la factura, repetidas o sin referencia", async () => {
    await dadaUnaConfiguracionFiscal();
    const { facturaId, lineas: [linea] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);
    const { lineas: [ajena] } = await dadaUnaFacturaAutorizadaConLineas([{ cantidad: 5 }]);

    const lineaAjena = await cuandoSeEmiteUnRemito({ clase: "X", facturaId, lineas: [{ factura_linea_id: ajena.id, cantidad: 1 }] });
    const repetida = await cuandoSeEmiteUnRemito({
      clase: "X",
      facturaId,
      lineas: [{ factura_linea_id: linea.id, cantidad: 1 }, { factura_linea_id: linea.id, cantidad: 1 }],
    });
    const sinReferencia = await cuandoSeEmiteUnRemito({ clase: "X", facturaId, lineas: [{ descripcion: "Libre", cantidad: 1 }] });

    expectErrorDeNegocio(lineaAjena.error, "no corresponde a una línea de la factura");
    expectErrorDeNegocio(repetida.error, "está repetida en el remito");
    expectErrorDeNegocio(sinReferencia.error, "debe corresponder a una línea de la factura");
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
