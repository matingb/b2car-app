import { describe, expect, it } from "vitest";
import { testClient } from "@/tests/integration";
import {
  adminClient,
  configuracionRValida,
  dadaUnaConfiguracionFiscal,
  dadaUnaConfiguracionRemitos,
  dadoUnRemitoEmitido,
  expectErrorDeNegocio,
  leerLineasRemito,
  leerRemito,
} from "./remitosHelpers";

describe("Integration: inmutabilidad de remitos (B2C-202)", () => {
  it("no permite UPDATE ni DELETE directos como usuario autenticado", async () => {
    await dadaUnaConfiguracionFiscal();
    const remitoId = await dadoUnRemitoEmitido({ clase: "X" });
    const [linea] = await leerLineasRemito(remitoId);

    const update = await testClient.from("remitos").update({ observaciones: "cambio" }).eq("id", remitoId).select("id");
    const remove = await testClient.from("remitos").delete().eq("id", remitoId).select("id");
    const updateLinea = await testClient.from("remitos_lineas").update({ cantidad: 99 }).eq("id", linea.id).select("id");
    const insert = await testClient.from("remitos").insert({ clase: "X" }).select("id");

    for (const result of [update, remove, updateLinea, insert]) {
      expect(result.error?.code).toBe("42501");
    }
    expect((await leerRemito(remitoId)).observaciones).toBeNull();
  });

  it("no permite UPDATE ni DELETE directos ni siquiera como service role", async () => {
    await dadaUnaConfiguracionFiscal();
    const remitoId = await dadoUnRemitoEmitido({ clase: "X" });
    const [linea] = await leerLineasRemito(remitoId);

    const update = await adminClient.from("remitos").update({ numero: 99 }).eq("id", remitoId);
    const remove = await adminClient.from("remitos").delete().eq("id", remitoId);
    const updateLinea = await adminClient.from("remitos_lineas").update({ cantidad: 99 }).eq("id", linea.id);
    const removeLinea = await adminClient.from("remitos_lineas").delete().eq("id", linea.id);

    expectErrorDeNegocio(update.error, "El remito emitido es inmutable");
    expectErrorDeNegocio(remove.error, "Los remitos emitidos no se pueden eliminar");
    expectErrorDeNegocio(updateLinea.error, "son inmutables");
    expectErrorDeNegocio(removeLinea.error, "no se pueden eliminar");
    for (const result of [update, remove, updateLinea, removeLinea]) {
      expect(result.error?.code).toBe("55000");
    }
    expect((await leerRemito(remitoId)).numero).toBe(1);
  });

  it("conserva los snapshots aunque cambien la configuración fiscal y el CAI", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());
    const remitoId = await dadoUnRemitoEmitido({ clase: "R" });
    const antes = await leerRemito(remitoId);

    await dadaUnaConfiguracionFiscal({ razon_social: "Nueva Razón Social SA", cuit: "30712345678", domicilio: "Otra calle 9" });
    await dadaUnaConfiguracionRemitos({ r_cai: "79999999999999", r_autoimpresor: false });

    expect(await leerRemito(remitoId)).toEqual(antes);
    expect(antes).toMatchObject({
      cai: "71234567890123",
      emisor_snapshot: expect.objectContaining({ razonSocial: "Taller Remitos SRL", cuit: "20123456786" }),
    });
  });

  it("rechaza guardar la configuración con un próximo número menor o igual al último emitido", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());
    await dadoUnRemitoEmitido({ clase: "R" });
    await dadoUnRemitoEmitido({ clase: "R" });
    await dadoUnRemitoEmitido({ clase: "X" });

    const r = await testClient.from("remitos_configuracion").update({ r_proximo_numero: 2 }).eq("ambiente", "HOMOLOGACION");
    const x = await testClient.from("remitos_configuracion").update({ x_proximo_numero: 1 }).eq("ambiente", "HOMOLOGACION");
    const nuevoPunto = await testClient
      .from("remitos_configuracion")
      .update({ r_punto_emision: 2, r_proximo_numero: 1 })
      .eq("ambiente", "HOMOLOGACION");

    expectErrorDeNegocio(r.error, "El próximo número de Remito R debe ser mayor al último emitido (R 00001-00000002)");
    expectErrorDeNegocio(x.error, "El próximo número de Remito X debe ser mayor al último emitido (X 00001-00000001)");
    expect(nuevoPunto.error).toBeNull();
  });
});
