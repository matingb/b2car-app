import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createTestClient, SEED } from "@/tests/integration";
import {
  configuracionRValida,
  contarFilas,
  cuandoSeEmiteUnRemito,
  dadaUnaConfiguracionFiscal,
  dadaUnaConfiguracionRemitos,
  dadoOtroTenantConConfiguracionFiscal,
  dadoUnRemitoEmitido,
  expectErrorDeNegocio,
  fechaArgentina,
  leerConfiguracionRemitos,
  leerLineasRemito,
  leerRemito,
  lineaLibre,
} from "./remitosHelpers";

describe("Integration: emisión de remitos R y X (B2C-202)", () => {
  it("emite remitos X sin factura con numeración consecutiva y snapshots del emisor", async () => {
    await dadaUnaConfiguracionFiscal();

    const primero = await dadoUnRemitoEmitido({
      clase: "X",
      lineas: [lineaLibre({ cantidad: 2 }), lineaLibre({ codigo: null, descripcion: "Bulones", cantidad: "1.5" })],
      observaciones: "Entrega en depósito",
    });
    const segundo = await dadoUnRemitoEmitido({ clase: "X" });

    const remito = await leerRemito(primero);
    expect(remito).toMatchObject({
      clase: "X",
      tipo_comprobante: null,
      punto_emision: 1,
      numero: 1,
      fecha_emision: fechaArgentina(),
      factura_id: null,
      cai: null,
      impresion_snapshot: null,
      observaciones: "Entrega en depósito",
      emisor_snapshot: expect.objectContaining({
        razonSocial: "Taller Remitos SRL",
        cuit: "20123456786",
        condicionIva: "Responsable inscripto",
      }),
      destinatario_snapshot: expect.objectContaining({ nombre: "Juan Pérez", numeroDocumento: "30111222" }),
    });
    expect((await leerRemito(segundo)).numero).toBe(2);

    const lineas = await leerLineasRemito(primero);
    expect(lineas.map((linea) => [linea.ordinal, linea.codigo, linea.descripcion, Number(linea.cantidad)])).toEqual([
      [1, "COD-1", "Neumático 195/65 R15", 2],
      [2, null, "Bulones", 1.5],
    ]);
    expect(Object.keys(lineas[0])).not.toEqual(expect.arrayContaining(["importe_unitario", "subtotal"]));
  });

  it("mantiene secuencias independientes para R y X", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());

    const numeros: string[] = [];
    for (const clase of ["R", "X", "R", "X"] as const) {
      const remito = await leerRemito(await dadoUnRemitoEmitido({ clase }));
      numeros.push(`${remito.clase}${remito.numero}`);
    }

    expect(numeros).toEqual(["R1", "X1", "R2", "X2"]);
    const config = await leerConfiguracionRemitos();
    expect(config).toMatchObject({ r_proximo_numero: 3, x_proximo_numero: 3 });
  });

  it("guarda CAI, código 091 y autoimpresión en el remito R", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida({
      r_punto_emision: 3,
      r_proximo_numero: 8,
      r_numero_desde: 1,
      r_numero_hasta: 100,
      r_inicio_actividades: "2021-05-01",
    }));

    const remito = await leerRemito(await dadoUnRemitoEmitido({ clase: "R" }));

    expect(remito).toMatchObject({
      clase: "R",
      tipo_comprobante: 91,
      punto_emision: 3,
      numero: 8,
      cai: "71234567890123",
      cai_vencimiento: fechaArgentina(30),
      impresion_snapshot: {
        autoimpresor: true,
        numeroDesde: 1,
        numeroHasta: 100,
        inicioActividades: "2021-05-01",
        imprenta: null,
      },
    });
  });

  it.each([
    { caso: "sin CAI", config: { r_cai: null }, mensaje: "configurá el CAI" },
    { caso: "con CAI vencido ayer", config: { r_cai_vencimiento: fechaArgentina(-1) }, mensaje: "está vencido" },
    { caso: "sin punto de emisión", config: { r_punto_emision: null }, mensaje: "punto de emisión" },
    {
      caso: "fuera del rango autorizado",
      config: { r_numero_desde: 1, r_numero_hasta: 3, r_proximo_numero: 4 },
      mensaje: "fuera del rango autorizado",
    },
    {
      caso: "por debajo del rango autorizado",
      config: { r_numero_desde: 10, r_numero_hasta: 20, r_proximo_numero: 5 },
      mensaje: "fuera del rango autorizado",
    },
  ])("rechaza el remito R $caso sin consumir numeración", async ({ config, mensaje }) => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida(config));
    const antes = await leerConfiguracionRemitos();

    const { error } = await cuandoSeEmiteUnRemito({ clase: "R" });

    expectErrorDeNegocio(error, mensaje);
    expect(error?.code).toBe("P0001");
    expect((await leerConfiguracionRemitos())?.r_proximo_numero).toBe(antes?.r_proximo_numero);
  });

  it("acepta un CAI que vence hoy y rechaza el siguiente número cuando se agota el rango", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida({
      r_cai_vencimiento: fechaArgentina(),
      r_numero_desde: 1,
      r_numero_hasta: 2,
      r_proximo_numero: 2,
    }));

    const remito = await leerRemito(await dadoUnRemitoEmitido({ clase: "R" }));
    expect(remito.numero).toBe(2);

    const { error } = await cuandoSeEmiteUnRemito({ clase: "R" });
    expectErrorDeNegocio(error, "R 00001-00000003 está fuera del rango autorizado (00000001 a 00000002)");
  });

  it("emite X aunque R no esté configurado", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos({ r_cai: null });

    const { data, error } = await cuandoSeEmiteUnRemito({ clase: "X" });

    expect(error).toBeNull();
    expect(typeof data).toBe("string");
  });

  it("rechaza la emisión cuando faltan los datos fiscales del emisor", async () => {
    for (const clase of ["R", "X"] as const) {
      const { error } = await cuandoSeEmiteUnRemito({ clase });
      expectErrorDeNegocio(error, "Completá los datos fiscales del emisor");
    }
  });

  it("valida la forma de los ítems y del destinatario", async () => {
    await dadaUnaConfiguracionFiscal();

    const casos = [
      { lineas: [], mensaje: "al menos un ítem" },
      { lineas: [lineaLibre({ cantidad: 0 })], mensaje: "La cantidad del ítem 1" },
      { lineas: [lineaLibre({ cantidad: -1 })], mensaje: "La cantidad del ítem 1" },
      { lineas: [lineaLibre({ cantidad: "1.23456" })], mensaje: "hasta 4 decimales" },
      { lineas: [lineaLibre({ descripcion: "   " })], mensaje: "La descripción del ítem 1 es obligatoria" },
      { lineas: Array.from({ length: 201 }, () => lineaLibre()), mensaje: "hasta 200 ítems" },
      { lineas: [lineaLibre({ factura_linea_id: randomUUID() })], mensaje: "sin factura no pueden referenciar" },
    ];
    for (const caso of casos) {
      const { error } = await cuandoSeEmiteUnRemito({ clase: "X", lineas: caso.lineas });
      expectErrorDeNegocio(error, caso.mensaje);
    }

    const { error: sinNombre } = await cuandoSeEmiteUnRemito({ clase: "X", destinatario: { nombre: " " } });
    expectErrorDeNegocio(sinNombre, "El nombre del destinatario es obligatorio");

    const { error: dniInvalido } = await cuandoSeEmiteUnRemito({
      clase: "X",
      destinatario: { nombre: "Ana", tipoDocumento: 96, numeroDocumento: "123" },
    });
    expectErrorDeNegocio(dniInvalido, "DNI del destinatario");

    const { error: transportistaSinNombre } = await cuandoSeEmiteUnRemito({
      clase: "X",
      transportista: { nombre: "", cuit: "20123456786" },
    });
    expectErrorDeNegocio(transportistaSinNombre, "El nombre del transportista es obligatorio");

    // Cada rechazo revierte la transacción completa: no se crea configuración ni se consume numeración.
    expect(await leerConfiguracionRemitos()).toBeNull();
  });

  it("es idempotente: la misma clave devuelve el mismo remito y otra clase con la misma clave falla", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());
    const idempotencyKey = randomUUID();

    const primero = await cuandoSeEmiteUnRemito({ clase: "X", idempotencyKey });
    const reintento = await cuandoSeEmiteUnRemito({ clase: "X", idempotencyKey });
    const otraClase = await cuandoSeEmiteUnRemito({ clase: "R", idempotencyKey });

    expect(primero.error).toBeNull();
    expect(reintento.data).toBe(primero.data);
    expectErrorDeNegocio(otraClase.error, "La clave de idempotencia ya pertenece a otro remito");
    expect(await leerConfiguracionRemitos()).toMatchObject({ x_proximo_numero: 2, r_proximo_numero: 1 });
  });

  it("asigna números consecutivos sin huecos a emisiones simultáneas", async () => {
    await dadaUnaConfiguracionFiscal();

    const resultados = await Promise.all(Array.from({ length: 4 }, () => cuandoSeEmiteUnRemito({ clase: "X" })));

    expect(resultados.map((resultado) => resultado.error)).toEqual([null, null, null, null]);
    const numeros = await Promise.all(resultados.map(async (resultado) => (await leerRemito(resultado.data as string)).numero));
    expect([...numeros].sort()).toEqual([1, 2, 3, 4]);
  });

  it("rechaza la emisión de un usuario sin facturas:edit", async () => {
    await dadaUnaConfiguracionFiscal();
    const operativo = createTestClient({ userRole: "operativo" });

    const { error } = await cuandoSeEmiteUnRemito({ clase: "X" }, operativo);

    expect(error?.code).toBe("42501");
  });

  it("aísla los remitos por tenant", async () => {
    await dadaUnaConfiguracionFiscal();
    const remitoId = await dadoUnRemitoEmitido({ clase: "X" });
    const otroTenantId = await dadoOtroTenantConConfiguracionFiscal();
    const otroTenant = createTestClient({ tenantId: otroTenantId });

    const { data: visibles, error } = await otroTenant.from("remitos").select("id");
    const propio = await dadoUnRemitoEmitido({ clase: "X" }, otroTenant);

    expect(error).toBeNull();
    expect(visibles).toEqual([]);
    expect((await leerRemito(propio))).toMatchObject({ tenant_id: otroTenantId, numero: 1 });
    expect((await leerRemito(remitoId))).toMatchObject({ tenant_id: SEED.tenantId, numero: 1 });
  });

  it("no crea facturas ni intentos de emisión fiscal", async () => {
    await dadaUnaConfiguracionFiscal();
    await dadaUnaConfiguracionRemitos(configuracionRValida());
    const facturasAntes = await contarFilas("facturas_electronicas");
    const intentosAntes = await contarFilas("facturacion_emision_intentos");

    await dadoUnRemitoEmitido({ clase: "X" });
    await dadoUnRemitoEmitido({ clase: "R" });

    expect(await contarFilas("facturas_electronicas")).toBe(facturasAntes);
    expect(await contarFilas("facturacion_emision_intentos")).toBe(intentosAntes);
  });
});
