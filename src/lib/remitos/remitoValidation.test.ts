import { describe, expect, it } from "vitest";
import {
  calcularDisponibles,
  evaluarEmisor,
  evaluarRemitoR,
  excesosDeMapeo,
  hoyArgentinaISO,
  isCantidadValida,
  parseAsociarFacturaInput,
  parseEmitirRemitoInput,
  parseRemitosConfiguracionInput,
  sugerirMapeo,
} from "./remitoValidation";
import { formatRemitoCantidad, formatRemitoDocumento, formatRemitoNumero, type RemitoRConfiguracion } from "./types";

const KEY = "3f0c8a62-4f5d-4a4e-9a70-2b8a1d6c9e01";
const FACTURA_ID = "8b1e7c0a-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const LINEA_ID = "c0ffee00-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const LINEA_ID_2 = "c0ffee01-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

function emitirBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: KEY,
    clase: "X",
    facturaId: null,
    destinatario: { nombre: "Juan Pérez", tipoDocumento: 96, numeroDocumento: "30.111.222" },
    transportista: null,
    observaciones: "  ",
    lineas: [{ codigo: " A-1 ", descripcion: " Rueda ", cantidad: 2 }],
    ...overrides,
  };
}

function configR(overrides: Partial<RemitoRConfiguracion> = {}): RemitoRConfiguracion {
  return {
    cai: "71234567890123",
    caiVencimiento: "2026-10-31",
    puntoEmision: 1,
    numeroDesde: null,
    numeroHasta: null,
    proximoNumero: 1,
    inicioActividades: null,
    autoimpresor: true,
    imprenta: { razonSocial: null, cuit: null, fechaImpresion: null, habilitacion: null },
    ...overrides,
  };
}

describe("parseEmitirRemitoInput", () => {
  it("normaliza un remito sin factura", () => {
    expect(parseEmitirRemitoInput(emitirBody())).toEqual({
      value: {
        idempotencyKey: KEY,
        clase: "X",
        arregloId: null,
        facturaId: null,
        destinatario: {
          clienteId: null,
          nombre: "Juan Pérez",
          domicilio: null,
          tipoDocumento: 96,
          numeroDocumento: "30111222",
          condicionIvaReceptorId: null,
        },
        transportista: null,
        observaciones: null,
        lineas: [{ facturaLineaId: null, codigo: "A-1", descripcion: "Rueda", observaciones: null, cantidad: 2 }],
      },
    });
  });

  it("trata el documento 99 como destinatario sin documento y redondea cantidades flotantes", () => {
    const parsed = parseEmitirRemitoInput(emitirBody({
      destinatario: { nombre: "Consumidor final", tipoDocumento: 99, numeroDocumento: "0" },
      lineas: [{ descripcion: "Bulones", cantidad: 0.1 + 0.2 }],
    }));
    expect(parsed.value?.destinatario).toMatchObject({ tipoDocumento: null, numeroDocumento: null });
    expect(parsed.value?.lineas[0].cantidad).toBe(0.3);
  });

  it.each([
    [{ idempotencyKey: "x" }, "clave de idempotencia"],
    [{ clase: "Z" }, "Seleccioná el tipo de remito"],
    [{ clase: undefined }, "Seleccioná el tipo de remito"],
    [{ lineas: [] }, "al menos un ítem"],
    [{ lineas: Array.from({ length: 201 }, () => ({ descripcion: "a", cantidad: 1 })) }, "hasta 200 ítems"],
    [{ lineas: [{ descripcion: "a", cantidad: 0 }] }, "mayor a cero"],
    [{ lineas: [{ descripcion: "a", cantidad: -2 }] }, "mayor a cero"],
    [{ lineas: [{ descripcion: "a", cantidad: 1.23456 }] }, "hasta 4 decimales"],
    [{ lineas: [{ descripcion: "a", cantidad: Number.NaN }] }, "mayor a cero"],
    [{ lineas: [{ descripcion: "   ", cantidad: 1 }] }, "descripción del ítem 1 es obligatoria"],
    [{ lineas: [{ descripcion: "a".repeat(501), cantidad: 1 }] }, "500 caracteres"],
    [{ lineas: [{ descripcion: "a", cantidad: 1, facturaLineaId: LINEA_ID }] }, "sin factura no pueden referenciar"],
    [{ destinatario: { nombre: " " } }, "nombre del destinatario es obligatorio"],
    [{ destinatario: { nombre: "Ana", tipoDocumento: 80, numeroDocumento: "20123456789" } }, "CUIT o CUIL del destinatario no es válido"],
    [{ destinatario: { nombre: "Ana", tipoDocumento: 96, numeroDocumento: "123" } }, "DNI del destinatario"],
    [{ destinatario: { nombre: "Ana", tipoDocumento: 96 } }, "Completá el número de documento"],
    [{ destinatario: { nombre: "Ana", condicionIvaReceptorId: 99 } }, "condición IVA"],
    [{ transportista: { nombre: "", cuit: "20123456786" } }, "nombre del transportista es obligatorio"],
    [{ transportista: { nombre: "Fletes SA", cuit: "20123456789" } }, "CUIT del transportista no es un CUIT válido"],
    [{ observaciones: "x".repeat(1001) }, "1000 caracteres"],
  ])("rechaza %o", (overrides, message) => {
    const parsed = parseEmitirRemitoInput(emitirBody(overrides));
    expect(parsed.value).toBeUndefined();
    expect(parsed.error).toContain(message);
  });

  it("conserva líneas editadas y permite varias filas con la misma referencia a factura", () => {
    const valido = parseEmitirRemitoInput(emitirBody({
      facturaId: FACTURA_ID,
      lineas: [
        { facturaLineaId: LINEA_ID, codigo: "CAJA-1", descripcion: "Caja 1", cantidad: "1.5", observaciones: "Caja sellada" },
        { facturaLineaId: LINEA_ID, codigo: "CAJA-2", descripcion: "Caja 2", cantidad: 1 },
      ],
    }));
    expect(valido.value?.lineas).toEqual([
      { facturaLineaId: LINEA_ID, codigo: "CAJA-1", descripcion: "Caja 1", observaciones: "Caja sellada", cantidad: 1.5 },
      { facturaLineaId: LINEA_ID, codigo: "CAJA-2", descripcion: "Caja 2", observaciones: null, cantidad: 1 },
    ]);

    expect(parseEmitirRemitoInput(emitirBody({
      facturaId: FACTURA_ID,
      lineas: [{ descripcion: "Caja", cantidad: 1 }],
    })).value?.lineas).toEqual([{ facturaLineaId: null, codigo: null, descripcion: "Caja", observaciones: null, cantidad: 1 }]);
    expect(parseEmitirRemitoInput(emitirBody({
      facturaId: FACTURA_ID,
      lineas: [{ facturaLineaId: LINEA_ID, cantidad: 1 }],
    })).error).toContain("descripción del ítem 1 es obligatoria");
  });

  it("acepta el arreglo de origen junto a su factura y permite ítems libres", () => {
    const result = parseEmitirRemitoInput(emitirBody({
      arregloId: FACTURA_ID,
      facturaId: LINEA_ID,
      lineas: [{ facturaLineaId: LINEA_ID_2, descripcion: "Filtro", cantidad: 1 }],
    }));
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({ arregloId: FACTURA_ID, facturaId: LINEA_ID });
    expect(parseEmitirRemitoInput(emitirBody({
      arregloId: FACTURA_ID,
      facturaId: LINEA_ID,
    })).error).toBeUndefined();
  });

  it("acepta un transportista vacío como ausente y valida uno completo", () => {
    expect(parseEmitirRemitoInput(emitirBody({ transportista: { nombre: "", domicilio: " ", cuit: "" } })).value?.transportista)
      .toBeNull();
    expect(parseEmitirRemitoInput(emitirBody({
      transportista: { nombre: "Fletes SA", domicilio: "Ruta 3", cuit: "20-12345678-6" },
    })).value?.transportista).toEqual({ nombre: "Fletes SA", domicilio: "Ruta 3", cuit: "20123456786" });
  });
});

describe("parseAsociarFacturaInput", () => {
  it("acepta un mapeo completo", () => {
    expect(parseAsociarFacturaInput({
      facturaId: FACTURA_ID,
      lineas: [{ remitoLineaId: LINEA_ID_2, facturaLineaId: LINEA_ID }],
    })).toEqual({
      value: { facturaId: FACTURA_ID, lineas: [{ remitoLineaId: LINEA_ID_2, facturaLineaId: LINEA_ID }] },
    });
  });

  it.each([
    [{ facturaId: "x", lineas: [] }, "factura válida"],
    [{ facturaId: FACTURA_ID, lineas: [] }, "Asociá cada ítem"],
    [{ facturaId: FACTURA_ID, lineas: [{ remitoLineaId: LINEA_ID }] }, "Asociá cada ítem"],
    [{
      facturaId: FACTURA_ID,
      lineas: [{ remitoLineaId: LINEA_ID, facturaLineaId: LINEA_ID_2 }, { remitoLineaId: LINEA_ID, facturaLineaId: LINEA_ID_2 }],
    }, "una sola vez"],
  ])("rechaza %o", (body, message) => {
    expect(parseAsociarFacturaInput(body).error).toContain(message);
  });
});

describe("parseRemitosConfiguracionInput", () => {
  const body = {
    remitoR: {
      cai: "71234567890123",
      caiVencimiento: "2026-12-31",
      puntoEmision: "2",
      numeroDesde: 1,
      numeroHasta: 100,
      proximoNumero: 5,
      inicioActividades: "",
      autoimpresor: false,
      imprenta: { razonSocial: "Imprenta Sur", cuit: "30-71234567-1", fechaImpresion: "2026-01-10", habilitacion: "123" },
    },
    remitoX: { puntoEmision: 1, proximoNumero: 1 },
  };

  it("normaliza vacíos a null y números en texto", () => {
    expect(parseRemitosConfiguracionInput(body).value).toEqual({
      remitoR: {
        cai: "71234567890123",
        caiVencimiento: "2026-12-31",
        puntoEmision: 2,
        numeroDesde: 1,
        numeroHasta: 100,
        proximoNumero: 5,
        inicioActividades: null,
        autoimpresor: true,
        imprenta: { razonSocial: null, cuit: null, fechaImpresion: null, habilitacion: null },
      },
      remitoX: { puntoEmision: 1, proximoNumero: 1 },
    });
  });

  it.each([
    [{ remitoR: { ...body.remitoR, cai: "123" } }, "14 dígitos"],
    [{ remitoR: { ...body.remitoR, numeroDesde: 10, numeroHasta: 5 } }, "desde no puede ser mayor"],
    [{ remitoR: { ...body.remitoR, caiVencimiento: "2026-02-30" } }, "fecha válida"],
    [{ remitoR: { ...body.remitoR, proximoNumero: 0 } }, "próximo número del Remito R"],
    [{ remitoX: { puntoEmision: 100000, proximoNumero: 1 } }, "punto de emisión del Remito X"],
  ])("rechaza %o", (overrides, message) => {
    expect(parseRemitosConfiguracionInput({ ...body, ...overrides }).error).toContain(message);
  });
});

describe("evaluarRemitoR", () => {
  const hoy = "2026-10-06";

  it("es emitible con CAI vigente, punto y autoimpresión", () => {
    expect(evaluarRemitoR(configR(), hoy)).toEqual({ emitible: true, motivos: [] });
  });

  it("acepta un CAI que vence hoy", () => {
    expect(evaluarRemitoR(configR({ caiVencimiento: hoy }), hoy).emitible).toBe(true);
  });

  it.each([
    [{ cai: null }, "Falta configurar el CAI"],
    [{ caiVencimiento: null }, "vencimiento del CAI"],
    [{ caiVencimiento: "2026-10-05" }, "vencido (venció el 05/10/2026)"],
    [{ puntoEmision: null }, "punto de emisión"],
    [{ numeroDesde: 1, numeroHasta: 3, proximoNumero: 4 }, "R 00001-00000004 está fuera del rango autorizado (00000001 a 00000003)"],
    [{ numeroDesde: 10, proximoNumero: 2 }, "fuera del rango autorizado (00000010 a sin máximo)"],
    [{ proximoNumero: 99_999_999 }, "Se agotó la numeración"],
  ])("no es emitible con %o", (overrides, motivo) => {
    const evaluacion = evaluarRemitoR(configR(overrides), hoy);
    expect(evaluacion.emitible).toBe(false);
    expect(evaluacion.motivos.join(" ")).toContain(motivo);
  });

  it("no requiere datos de imprenta de configuraciones anteriores", () => {
    expect(evaluarRemitoR(configR({
      autoimpresor: false,
    }), hoy).emitible).toBe(true);
  });
});

describe("evaluarEmisor", () => {
  it("informa los datos fiscales faltantes", () => {
    expect(evaluarEmisor(null)).toEqual({
      completo: false,
      faltantes: ["Razón social", "CUIT", "Domicilio comercial", "Inicio de actividades"],
    });
    expect(evaluarEmisor({ razonSocial: "Taller", cuit: "20123456786", domicilio: "Calle 1", inicioActividades: "2020-01-01" }))
      .toEqual({ completo: true, faltantes: [] });
  });
});

describe("cantidades y mapeo", () => {
  const lineasFactura = calcularDisponibles([
    { id: "f1", ordinal: 1, origen: "REPUESTO", codigo: "FIL-1", descripcion: "Filtro de aceite", cantidad: 5 },
    { id: "f2", ordinal: 2, origen: "SERVICIO", codigo: null, descripcion: "Mano de obra", cantidad: 1 },
    { id: "f3", ordinal: 3, origen: "REPUESTO", codigo: "BUJ", descripcion: "Bujía", cantidad: 4 },
  ], [
    { facturaLineaId: "f1", cantidad: 1.5 },
    { facturaLineaId: "f1", cantidad: 1.25 },
    { facturaLineaId: "f3", cantidad: 4 },
    { facturaLineaId: null, cantidad: 9 },
  ]);

  it("calcula facturado, remitido y disponible por línea", () => {
    expect(lineasFactura.map(({ id, cantidadFacturada, cantidadRemitida, cantidadDisponible }) => ({
      id, cantidadFacturada, cantidadRemitida, cantidadDisponible,
    }))).toEqual([
      { id: "f1", cantidadFacturada: 5, cantidadRemitida: 2.75, cantidadDisponible: 2.25 },
      { id: "f2", cantidadFacturada: 1, cantidadRemitida: 0, cantidadDisponible: 1 },
      { id: "f3", cantidadFacturada: 4, cantidadRemitida: 4, cantidadDisponible: 0 },
    ]);
  });

  it("sugiere por código, luego por descripción y solo con disponibilidad suficiente", () => {
    expect(sugerirMapeo([
      { id: "r1", codigo: "fil-1", descripcion: "Otro nombre", cantidad: 2 },
      { id: "r2", codigo: null, descripcion: "MANO DE OBRA ", cantidad: 1 },
      { id: "r3", codigo: "BUJ", descripcion: "Bujía", cantidad: 1 },
      { id: "r4", codigo: "FIL-1", descripcion: "Filtro de aceite", cantidad: 1 },
    ], lineasFactura)).toEqual({ r1: "f1", r2: "f2" });
  });

  it("detecta excesos acumulados de un mapeo", () => {
    expect(excesosDeMapeo(
      [{ id: "r1", cantidad: 2 }, { id: "r2", cantidad: 1 }, { id: "r3", cantidad: 1 }],
      { r1: "f1", r2: "f1", r3: "f2" },
      lineasFactura,
    )).toEqual({ f1: 0.75 });
  });

  it("valida cantidades positivas con hasta 4 decimales", () => {
    expect(isCantidadValida(1.2345)).toBe(true);
    expect(isCantidadValida(1.23456)).toBe(false);
    expect(isCantidadValida(0)).toBe(false);
    expect(isCantidadValida(Infinity)).toBe(false);
  });
});

describe("formatos", () => {
  it("formatea número y documento del remito", () => {
    expect(formatRemitoNumero("R", 1, 8)).toBe("R 00001-00000008");
    expect(formatRemitoNumero("X", 12, 12345)).toBe("X 00012-00012345");
    expect(formatRemitoDocumento({ tipoDocumento: 80, numeroDocumento: "20123456786" })).toBe("CUIT 20123456786");
    expect(formatRemitoDocumento({ tipoDocumento: null, numeroDocumento: null })).toBeNull();
    expect(formatRemitoCantidad(1.5)).toBe("1,5");
    expect(formatRemitoCantidad(1250)).toBe("1.250");
    expect(formatRemitoCantidad(0.1234)).toBe("0,1234");
  });

  it("usa la fecha de Argentina cerca de la medianoche UTC", () => {
    expect(hoyArgentinaISO(new Date("2026-10-07T01:00:00Z"))).toBe("2026-10-06");
  });
});
