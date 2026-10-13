import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));

import { createClient } from "@/supabase/server";
import { lookupArcaPadronPerson } from "@/lib/arcaPadron/arcaPadronGateway";
import { assertIdempotencyReplay } from "./idempotency";
import {
  normalizedFacturaIntent,
  noteConceptLines,
  exportFacturasRows,
  ingresosBrutosEmisor,
  isVerifiedFiscalPdfCache,
  FacturacionValidationError,
  getDevolucionesDisponibles,
  listFacturas,
  parseNotaInput,
  resolvePdfReceiverSnapshot,
  resolvePdfEmitterSnapshot,
  validateConfigurationInput,
} from "./facturacionService";

function createQueryChain() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "gte", "lte", "or"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled, onRejected);
  return chain;
}

describe("filtros de fecha de Facturas", () => {
  let query: ReturnType<typeof createQueryChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = createQueryChain();
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(query),
    } as never);
  });

  it("lista con ambos extremos inclusivos de la columna date, sin conversión de zona", async () => {
    await listFacturas("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });

  it("conserva los mismos extremos inclusivos en la exportación", async () => {
    await exportFacturasRows("tenant-1", { desde: "2026-09-01", hasta: "2026-09-13" });

    expect(query.gte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-01");
    expect(query.lte).toHaveBeenCalledWith("fecha_comprobante", "2026-09-13");
  });
});

describe("receptor del PDF fiscal", () => {
  const clientRows: Record<string, unknown> = {};

  function mockClientTables() {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq"]) chain[method] = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: clientRows[table] ?? null, error: null });
        return chain;
      }),
    } as never);
  }

  const snapshot = {
    clienteId: "cliente-1",
    nombre: "Cliente Registrado",
    domicilio: "Calle Ficha 123",
    tipoDocumento: 80,
    numeroDocumento: "30712345671",
    condicionIvaReceptorId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(clientRows)) delete clientRows[key];
    clientRows.clientes = { id: "cliente-1", tipo_cliente: "empresa" };
    clientRows.empresas = { nombre: "Cliente Registrado", direccion: "Calle Ficha 123", cuit: "20-11111111-2" };
    mockClientTables();
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "30712345671", tipoPersona: "JURIDICA", estadoClave: "ACTIVO",
        nombre: "Otra Empresa SA", apellido: null, razonSocial: "Otra Empresa SA",
        nombreCompleto: "Otra Empresa SA", direccion: "Av. Fiscal 456",
      },
    });
  });

  it("usa razón social y domicilio del padrón cuando el CUIT no es el del cliente registrado", async () => {
    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).resolves.toEqual({
      ...snapshot,
      nombre: "Otra Empresa SA",
      domicilio: "Av. Fiscal 456",
    });
    expect(lookupArcaPadronPerson).toHaveBeenCalledWith(80, "30712345671");
  });

  it("no imprime el domicilio de la ficha si el padrón no informa domicilio", async () => {
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "30712345671", tipoPersona: "JURIDICA", estadoClave: "ACTIVO",
        nombre: "Otra Empresa SA", apellido: null, razonSocial: "Otra Empresa SA",
        nombreCompleto: "Otra Empresa SA", direccion: null,
      },
    });

    const receiver = await resolvePdfReceiverSnapshot("tenant-1", snapshot);

    expect(receiver.domicilio).toBeNull();
  });

  it("conserva el snapshot cuando el CUIT es el del cliente registrado", async () => {
    clientRows.empresas = { nombre: "Cliente Registrado", direccion: "Calle Ficha 123", cuit: "30-71234567-1" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).resolves.toBe(snapshot);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("reconoce como propio el CUIL asociado al DNI guardado en la ficha", async () => {
    clientRows.clientes = { id: "cliente-1", tipo_cliente: "particular" };
    clientRows.particulares = { nombre: "Juan", apellido: "Pérez", direccion: "Calle 1", dni_cuil: "12.345.678" };
    const cuilSnapshot = { ...snapshot, tipoDocumento: 86, numeroDocumento: "20123456786" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", cuilSnapshot)).resolves.toBe(cuilSnapshot);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("consulta el padrón cuando el comprobante no tiene cliente registrado", async () => {
    const receiver = await resolvePdfReceiverSnapshot("tenant-1", {
      ...snapshot, clienteId: null, nombre: "Consumidor final", domicilio: null,
    });

    expect(receiver.nombre).toBe("Otra Empresa SA");
    expect(receiver.domicilio).toBe("Av. Fiscal 456");
  });

  it("no consulta el padrón para consumidor final sin identificar", async () => {
    const consumer = { ...snapshot, tipoDocumento: 99, numeroDocumento: "0" };

    await expect(resolvePdfReceiverSnapshot("tenant-1", consumer)).resolves.toBe(consumer);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("falla en lugar de imprimir los datos del cliente registrado si ARCA no responde", async () => {
    vi.mocked(lookupArcaPadronPerson).mockRejectedValue(new Error("ARCA no disponible"));

    await expect(resolvePdfReceiverSnapshot("tenant-1", snapshot)).rejects.toBeInstanceOf(FacturacionValidationError);
  });
});



describe("configuración explícita del sistema FCE", () => {
  const config = {
    razonSocial: "Taller", cuit: "20123456786", condicionIvaEmisor: "MONOTRIBUTISTA",
    domicilio: "Calle 1", inicioActividades: "2020-01-01", puntoVenta: 1, fceCbu: null,
    ingresosBrutosCondicion: "EXENTO",
  };

  it("exige la condición IIBB y el número sólo para inscriptos", () => {
    expect(() => validateConfigurationInput({ ...config, ingresosBrutosCondicion: null })).toThrow("Elegí la condición frente a Ingresos Brutos");
    expect(() => validateConfigurationInput({ ...config, ingresosBrutosCondicion: "INSCRIPTO", ingresosBrutos: " " })).toThrow("Completá el número de inscripción");
    expect(validateConfigurationInput({ ...config, ingresosBrutosCondicion: "INSCRIPTO", ingresosBrutos: "901-123456-7" }))
      .toMatchObject({ ingresosBrutosCondicion: "INSCRIPTO", ingresosBrutos: "901-123456-7" });
    expect(validateConfigurationInput({ ...config, ingresosBrutosCondicion: "NO_CONTRIBUYENTE", ingresosBrutos: "901-123456-7" }))
      .toMatchObject({ ingresosBrutosCondicion: "NO_CONTRIBUYENTE", ingresosBrutos: null });
  });

  it("informa en el comprobante el número de inscripción o la condición IIBB", () => {
    expect(ingresosBrutosEmisor({ ingresosBrutosCondicion: "INSCRIPTO", ingresosBrutos: "901-123456-7" })).toBe("901-123456-7");
    expect(ingresosBrutosEmisor({ ingresosBrutosCondicion: "EXENTO", ingresosBrutos: null })).toBe("Exento");
    expect(ingresosBrutosEmisor({ ingresosBrutosCondicion: "NO_CONTRIBUYENTE", ingresosBrutos: null })).toBe("No contribuyente");
  });

  it("conserva modalidad sin elegir como null y no infiere SCA", () => {
    expect(validateConfigurationInput(config).fceSistema).toBeNull();
  });

  it("rechaza una modalidad no permitida en lugar de convertirla a SCA", () => {
    expect(() => validateConfigurationInput({ ...config, fceSistema: "OTRA" })).toThrow("El sistema de circulación FCE debe ser SCA o ADC");
  });
});

describe("datos del emisor para el PDF FCE", () => {
  const emitter = { cuit: "20123456786", domicilio: "Calle 1", ingresosBrutos: "-" };
  function mockConfig(cuit: string, ingresosBrutos: string | null, condicion: string | null = ingresosBrutos ? "INSCRIPTO" : null) {
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { cuit, ingresos_brutos: ingresosBrutos, ingresos_brutos_condicion: condicion }, error: null }) };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    const from = vi.fn().mockReturnValue(chain);
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    return { chain, from };
  }
  it("completa únicamente IIBB faltante con configuración del mismo CUIT, tenant y ambiente", async () => {
    const { chain, from } = mockConfig("20-12345678-6", "Convenio Multilateral 901-123456-7");
    const result = await resolvePdfEmitterSnapshot("tenant-1", "HOMOLOGACION", emitter, 211);
    expect(result).toEqual({ ...emitter, ingresosBrutos: "Convenio Multilateral 901-123456-7", ingresosBrutosCondicion: "INSCRIPTO" });
    expect(emitter.ingresosBrutos).toBe("-");
    expect(from).toHaveBeenCalledWith("facturacion_configuracion_ambiente");
    expect(chain.eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(chain.eq).toHaveBeenCalledWith("ambiente", "HOMOLOGACION");
  });
  it("completa la condición exento cuando el emisor no tiene número de inscripción", async () => {
    mockConfig(emitter.cuit, null, "EXENTO");
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 211))
      .toEqual({ ...emitter, ingresosBrutos: "Exento", ingresosBrutosCondicion: "EXENTO" });
  });
  it("no toma IIBB de otro CUIT ni inventa información ausente", async () => {
    mockConfig("30712345671", null, "EXENTO");
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 211)).toBe(emitter);
    mockConfig(emitter.cuit, null);
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 211)).toBe(emitter);
  });
  it("conserva IIBB del snapshot y no consulta configuración para facturas convencionales", async () => {
    const { from } = mockConfig(emitter.cuit, "EXENTO");
    const complete = { ...emitter, ingresosBrutos: "LOCAL 123456" };
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", complete, 211)).toBe(complete);
    expect(await resolvePdfEmitterSnapshot("tenant-1", "PRODUCCION", emitter, 11)).toBe(emitter);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("integridad de caché PDF fiscal", () => {
  const bytes = new TextEncoder().encode("PDF fiscal autorizado");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = "tenant-1/homologacion/factura-1/fiscal-v11.pdf";

  it("permite redescargar la caché legítima cuando ruta, versión e hash coinciden", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v11", expectedPath: path, storedSha256: sha256, bytes })).toBe(true);
  });

  it("rechaza metadatos apuntados a otro objeto o bytes reemplazados", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: "tenant-1/otro.pdf", storedVersion: "fiscal-v11", expectedPath: path, storedSha256: sha256, bytes })).toBe(false);
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v11", expectedPath: path, storedSha256: "0".repeat(64), bytes })).toBe(false);
  });
  it("invalida la versión anterior aunque el hash coincida", () => {
    expect(isVerifiedFiscalPdfCache({ storedPath: path, storedVersion: "fiscal-v4", expectedPath: path, storedSha256: sha256, bytes })).toBe(false);
  });
});

describe("B2C-197: notas desde snapshots netos", () => {
  it("acredita lo facturado con IVA y fiscaliza la nota como incluida, también desde detalle simplificado", async () => {
    const { fiscalizeLineas } = await import("./arcaPayload");
    const lines = [5, 4].map((ivaAlicuotaId, index) => ({
      ordinal: index + 1, origen: "SERVICIO" as const, descripcion: "Servicio",
      cantidad: 1, importeUnitario: 100, subtotal: 100, ivaAlicuotaId,
    }));
    const original = fiscalizeLineas(lines, "RESPONSABLE_INSCRIPTO", false, 0.21);
    const fullConcepts = original.lineas.map((line) => ({ ordinal: line.ordinal, descripcion: null, ivaAlicuotaId: null, importe: line.importeTotal! }));
    const full = fiscalizeLineas(noteConceptLines(original.lineas, fullConcepts, []), "RESPONSABLE_INSCRIPTO");
    expect(full.totales).toEqual(original.totales);
    expect(() => noteConceptLines(original.lineas, [{ ...fullConcepts[0], importe: original.lineas[0].importeTotal! + 0.01 }], []))
      .toThrow("supera lo facturado en esa línea");
    const simplified = { ...original.lineas[0], subtotal: original.totales.total, importeTotal: original.totales.total, snapshot: { lineasOriginales: original.lineas } };
    expect(noteConceptLines([simplified], fullConcepts, [])).toEqual(noteConceptLines(original.lineas, fullConcepts, []));
  });
});

describe("B2C-197: replay fiscal preparado", () => {
  it("devuelve snapshot autorizado antes de consultar arreglo o configuración actual", async () => {
    const replayInput = { idempotencyKey: "key", ambiente: "HOMOLOGACION" } as never;
    const intentHash = createHash("sha256").update(JSON.stringify(normalizedFacturaIntent("ARREGLO", "repair", replayInput))).digest("hex");
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: table === "facturacion_idempotencia_intenciones"
        ? { factura_id: "invoice", contenido_hash: intentHash }
        : { id: "invoice", estado: "AUTORIZADA", intencion_hash: intentHash, arreglo_id: "repair", origen_tipo: "ARREGLO", documento_tipo: "FACTURA", ambiente: "HOMOLOGACION", total: 121 }, error: null });
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    const { issueFacturaElectronica } = await import("./facturacionService");
    const result = await issueFacturaElectronica({ tenantId: "tenant", userId: "user" } as never, "repair", replayInput);
    expect(result).toMatchObject({ httpStatus: 200, invoice: { id: "invoice", total: 121 } });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["facturacion_idempotencia_intenciones", "facturas_electronicas"]);
  });
});

describe("B2C-197: idempotencia vincula el contenido del pedido", () => {
  const base = {
    idempotencyKey: "same-key", ambiente: "HOMOLOGACION", condicionVenta: "CONTADO", detalleSimplificado: false,
    receptor: { tipoDocumento: 80, numeroDocumento: "20123456786", condicionIvaReceptorId: 1 },
    fechas: { fechaComprobante: "2026-10-10", fechaServicioDesde: "2026-10-10", fechaServicioHasta: "2026-10-10", fechaVencimientoPago: "2026-10-10" },
  };
  it.each([
    ["date", { ...base, fechas: { ...base.fechas, fechaComprobante: "2026-10-11" } }],
    ["receiver document", { ...base, receptor: { ...base.receptor, numeroDocumento: "20123456787" } }],
    ["condition", { ...base, condicionVenta: "CREDITO" }],
    ["detail", { ...base, detalleSimplificado: true }],
  ])("rejects replay with changed %s", (_field, changed) => {
    const original = createHash("sha256").update(JSON.stringify(normalizedFacturaIntent("ARREGLO", "repair", base as never))).digest("hex");
    const requested = createHash("sha256").update(JSON.stringify(normalizedFacturaIntent("ARREGLO", "repair", changed as never))).digest("hex");
    expect(requested).not.toBe(original);
    expect(() => assertIdempotencyReplay(original, original, requested)).toThrow("contenido diferente");
  });
});

describe("B2C-197: replay cuando falta el índice de intención", () => {
  it("rechaza una solicitud distinta comparando el hash duradero antes de cargar fuente/configuración", async () => {
    vi.clearAllMocks();
    const originalInput = {
      idempotencyKey: "same-key", ambiente: "HOMOLOGACION", condicionVenta: "CONTADO", detalleSimplificado: false,
      receptor: { tipoDocumento: 80, numeroDocumento: "20123456786", condicionIvaReceptorId: 1 },
      fechas: { fechaComprobante: "2026-10-10", fechaServicioDesde: "2026-10-10", fechaServicioHasta: "2026-10-10", fechaVencimientoPago: "2026-10-10" },
    };
    const changedInput = { ...originalInput, condicionVenta: "CREDITO" };
    const oldHash = createHash("sha256").update(JSON.stringify(normalizedFacturaIntent("ARREGLO", "repair", originalInput as never))).digest("hex");
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: table === "facturacion_idempotencia_intenciones" ? null : {
          id: "invoice", estado: "AUTORIZADA", intencion_hash: oldHash,
          arreglo_id: "repair", operacion_id: null, origen_tipo: "ARREGLO",
          documento_tipo: "FACTURA", ambiente: "HOMOLOGACION", total: 121,
        },
        error: null,
      });
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    const { issueFacturaElectronica } = await import("./facturacionService");

    await expect(issueFacturaElectronica({ tenantId: "tenant", userId: "user" } as never, "repair", changedInput as never))
      .rejects.toThrow("contenido diferente");
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "facturacion_idempotencia_intenciones", "facturas_electronicas",
    ]);
  });
});

describe("devolución de stock por nota de crédito", () => {
  const line1 = "11111111-1111-4111-8111-111111111111";
  const line2 = "22222222-2222-4222-8222-222222222222";
  const noteKey = "33333333-3333-4333-8333-333333333333";

  const conceptos = [
    { ordinal: 1, importe: 20 },
    // La alícuota del cliente se ignora: los conceptos nuevos usan el IVA configurado por ambiente.
    { descripcion: "Bonificación comercial", ivaAlicuotaId: 4, importe: 5.5 },
  ];
  const parsedConceptos = [
    { ordinal: 1, descripcion: null, ivaAlicuotaId: null, importe: 20 },
    { ordinal: null, descripcion: "Bonificación comercial", ivaAlicuotaId: 5, importe: 5.5 },
  ];
  const fromInvoice = (ordinal: number, importe: number) => ({ ordinal, descripcion: null, ivaAlicuotaId: null, importe });

  it("aplica a los conceptos nuevos la alícuota del IVA configurado por ambiente", () => {
    const parse = () => parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 10, idempotencyKey: noteKey, conceptos: [{ descripcion: "Bonificación", importe: 10 }],
    }).conceptos[0].ivaAlicuotaId;
    vi.stubEnv("IVA_RATE", "0.105");
    expect(parse()).toBe(4);
    vi.stubEnv("IVA_RATE", "0.19");
    expect(parse).toThrow("no corresponde a una alícuota de ARCA");
    vi.unstubAllEnvs();
  });

  it("parsea conceptos de la factura, conceptos nuevos y cantidades enteras no negativas", () => {
    expect(parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 25.5, conceptos,
      idempotencyKey: noteKey, devoluciones: [{ operacionLineaId: line1, cantidad: 2 }],
    })).toEqual({
      tipo: "NOTA_CREDITO", importe: 25.5, conceptos: parsedConceptos,
      idempotencyKey: noteKey, devoluciones: [{ operacionLineaId: line1, cantidad: 2 }],
    });
  });

  it.each([
    [[{ operacionLineaId: line1, cantidad: -1 }]],
    [[{ operacionLineaId: line1, cantidad: 1.5 }]],
    [[{ operacionLineaId: line1, cantidad: 1 }, { operacionLineaId: line1, cantidad: 1 }]],
  ])("rechaza cantidades inválidas o líneas duplicadas: %j", (devoluciones) => {
    expect(() => parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 25, idempotencyKey: noteKey, devoluciones, conceptos: [{ ordinal: 1, importe: 25 }],
    })).toThrow(FacturacionValidationError);
  });

  it.each([
    ["sin conceptos", [], "Agregá al menos un concepto"],
    ["suma distinta al total", [{ ordinal: 1, importe: 20 }], "La suma de los conceptos no coincide"],
    ["línea de la factura repetida", [{ ordinal: 1, importe: 12.75 }, { ordinal: 1, importe: 12.75 }], "No se puede repetir una línea de la factura"],
    ["monto con más de dos decimales", [{ ordinal: 1, importe: 25.499 }, { ordinal: 2, importe: 0.001 }], "monto positivo"],
    ["monto en cero", [{ ordinal: 1, importe: 25.5 }, { ordinal: 2, importe: 0 }], "monto positivo"],
    ["concepto nuevo sin descripción", [{ descripcion: "  ", importe: 25.5 }], "descripción de hasta 200"],
  ])("rechaza conceptos inválidos: %s", (_case, invalid, message) => {
    expect(() => parseNotaInput({
      tipo: "NOTA_CREDITO", importe: 25.5, idempotencyKey: noteKey, conceptos: invalid,
    })).toThrow(message);
  });

  it("una nota de débito sólo admite conceptos nuevos, que suman su importe", () => {
    expect(parseNotaInput({
      tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey, conceptos: [{ descripcion: "Recargo por mora", importe: 25 }],
    })).toEqual({
      tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey, devoluciones: [],
      conceptos: [{ ordinal: null, descripcion: "Recargo por mora", ivaAlicuotaId: 5, importe: 25 }],
    });
    expect(() => parseNotaInput({
      tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey, conceptos: [{ ordinal: 1, importe: 25 }],
    })).toThrow("Las notas de débito sólo admiten conceptos nuevos");
    expect(() => parseNotaInput({ tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey, conceptos: [] }))
      .toThrow("Agregá al menos un concepto");
  });

  describe("líneas de la nota de crédito por concepto", () => {
    const original = [
      { ordinal: 1, origen: "VENTA" as const, sourceId: line1, descripcion: "Batería 55Ah", codigo: "BAT-55", cantidad: 5, importeUnitario: 1000, subtotal: 5000, ivaAlicuotaId: 5 },
      { ordinal: 2, origen: "SERVICIO" as const, sourceId: null, descripcion: "Mano de obra", cantidad: 1, importeUnitario: 3000, subtotal: 3000, ivaAlicuotaId: 5 },
      { ordinal: 3, origen: "VENTA" as const, sourceId: line2, descripcion: "Aceite 5W30", codigo: "ACE", cantidad: 3, importeUnitario: 500, subtotal: 1500, ivaAlicuotaId: 4 },
    ];

    it("detalla los conceptos elegidos y los nuevos, con su monto y la cantidad devuelta", () => {
      const lines = noteConceptLines(
        original,
        [fromInvoice(1, 2000), fromInvoice(2, 499.99), { ordinal: null, descripcion: "Bonificación", ivaAlicuotaId: 4, importe: 150 }],
        [{ operacionLineaId: line1, cantidad: 2 }],
      );
      expect(lines).toEqual([
        expect.objectContaining({ ordinal: 1, origen: "AJUSTE", sourceId: null, descripcion: "Batería 55Ah", codigo: "BAT-55", cantidad: 2, importeUnitario: 1000, subtotal: 2000, ivaAlicuotaId: 5, snapshot: { lineaOriginal: {}, ordinalOriginal: 1, preciosIncluyenIva: true } }),
        expect.objectContaining({ ordinal: 2, origen: "AJUSTE", descripcion: "Mano de obra", cantidad: 1, importeUnitario: 499.99, subtotal: 499.99 }),
        { ordinal: 3, origen: "AJUSTE", sourceId: null, descripcion: "Bonificación", codigo: null, cantidad: 1, importeUnitario: 150, subtotal: 150, tratamientoIva: "GRAVADO", ivaAlicuotaId: 4, snapshot: { conceptoPropio: true, preciosIncluyenIva: true } },
      ]);
    });

    it("usa una unidad cuando el monto no se divide en centavos exactos por la cantidad", () => {
      const [line] = noteConceptLines(original, [fromInvoice(1, 1000)], [{ operacionLineaId: line1, cantidad: 3 }]);
      expect(line).toEqual(expect.objectContaining({ cantidad: 1, importeUnitario: 1000, subtotal: 1000 }));
    });

    it("rechaza un concepto que supera lo facturado en su línea", () => {
      expect(() => noteConceptLines(original, [fromInvoice(3, 1500.01)], []))
        .toThrow("supera lo facturado en esa línea");
    });

    it("rechaza un concepto que no pertenece a la factura", () => {
      expect(() => noteConceptLines(original, [fromInvoice(9, 10)], []))
        .toThrow("Uno de los conceptos no pertenece a la factura original");
    });

    it("exige agregar como concepto el producto cuyo stock se devuelve", () => {
      expect(() => noteConceptLines(original, [fromInvoice(2, 100)], [{ operacionLineaId: line2, cantidad: 1 }]))
        .toThrow("Para devolver stock de un producto, agregalo como concepto de la nota");
      expect(noteConceptLines(original, [fromInvoice(2, 100)], [{ operacionLineaId: line2, cantidad: 0 }])).toHaveLength(1);
    });
  });

  it("rechaza devoluciones en una nota de débito", () => {
    expect(() => parseNotaInput({
      tipo: "NOTA_DEBITO", importe: 25, idempotencyKey: noteKey, conceptos: [{ descripcion: "Recargo", importe: 25 }],
      devoluciones: [{ operacionLineaId: line1, cantidad: 1 }],
    })).toThrow("Las notas de débito no modifican el stock");
  });

  it("calcula vendido, devuelto, reservado y restante según el estado de cada NC", async () => {
    const rows: Record<string, unknown> = {
      factura: { id: "factura-1", origen_tipo: "VENTA", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: "sha256" },
      facturacion_factura_stock_origenes: [
        { operacion_linea_id: line1, operacion_origen_id: "venta-1", stock_id: "stock-1", taller_id: "taller-1", producto_id: "producto-1", origen_linea: "VENTA", cantidad_original: 5, nombre_snapshot: "Producto A", codigo_snapshot: "A" },
        { operacion_linea_id: line2, operacion_origen_id: "venta-1", stock_id: "stock-2", taller_id: "taller-1", producto_id: "producto-2", origen_linea: "VENTA", cantidad_original: 3, nombre_snapshot: "Producto B", codigo_snapshot: "B" },
      ],
      operaciones_lineas: [{ id: line1, stock_id: "stock-1" }, { id: line2, stock_id: "stock-2" }],
      stocks: [{ id: "stock-1", producto_id: "producto-1" }, { id: "stock-2", producto_id: "producto-2" }],
      productos: [
        { id: "producto-1", nombre: "Producto A", codigo: "A" },
        { id: "producto-2", nombre: "Producto B", codigo: "B" },
      ],
      reservations: [
        { nota_credito_id: "nc-autorizada", operacion_linea_id: line1, cantidad: 1 },
        { nota_credito_id: "nc-incierta", operacion_linea_id: line1, cantidad: 2 },
        { nota_credito_id: "nc-rechazada", operacion_linea_id: line2, cantidad: 3 },
      ],
      notes: [
        { id: "nc-autorizada", estado: "AUTORIZADA" },
        { id: "nc-incierta", estado: "INCIERTA" },
        { id: "nc-rechazada", estado: "RECHAZADA" },
      ],
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      let noteLookup = false;
      for (const method of ["select", "eq", "order"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn((column: string) => {
        if (table === "facturas_electronicas" && column === "id") noteLookup = true;
        return chain;
      });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: rows.factura, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({
          data: table === "facturas_electronicas" && noteLookup
            ? rows.notes
            : table === "facturacion_nc_devoluciones" ? rows.reservations : rows[table],
          error: null,
        }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "factura-1")).resolves.toEqual({
      origenTipo: "VENTA", procedenciaVerificada: true, advertencia: null, items: [
        { operacionLineaId: line1, nombre: "Producto A", codigo: "A", origenLinea: "VENTA", tallerId: "taller-1", cantidadOriginal: 5, vendido: 5, devuelto: 1, reservado: 2, restante: 2 },
        { operacionLineaId: line2, nombre: "Producto B", codigo: "B", origenLinea: "VENTA", tallerId: "taller-1", cantidadOriginal: 3, vendido: 3, devuelto: 0, reservado: 0, restante: 3 },
      ],
    });
  });

  it("ofrece repuestos asignados a una factura de arreglo con su saldo físico", async () => {
    const repairInvoice = { id: "factura-arreglo", origen_tipo: "ARREGLO", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: "sha256" };
    const origin = {
      operacion_linea_id: line1, operacion_origen_id: "asignacion-1", stock_id: "stock-1",
      taller_id: "taller-1", producto_id: "producto-1", origen_linea: "REPUESTO",
      cantidad_original: 4, nombre_snapshot: "Filtro", codigo_snapshot: "FIL-1",
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "in"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: repairInvoice, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({ data: table === "facturacion_factura_stock_origenes" ? [origin] : [], error: null }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "factura-arreglo")).resolves.toEqual({
      origenTipo: "ARREGLO", procedenciaVerificada: true, advertencia: null, items: [{
        operacionLineaId: line1, nombre: "Filtro", codigo: "FIL-1", origenLinea: "REPUESTO",
        tallerId: "taller-1", cantidadOriginal: 4, vendido: 4, devuelto: 0, reservado: 0, restante: 4,
      }],
    });
  });

  it("advierte si una factura histórica carece de procedencia física verificable", async () => {
    const oldInvoice = { id: "factura-antigua", origen_tipo: "ARREGLO", estado: "AUTORIZADA", documento_tipo: "FACTURA", stock_origenes_hash: null };
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "in"]) chain[method] = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: oldInvoice, error: null });
      chain.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
      return chain;
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    const result = await getDevolucionesDisponibles("tenant-1", "factura-antigua");
    expect(result.origenTipo).toBe("ARREGLO");
    expect(result.procedenciaVerificada).toBe(false);
    expect(result.advertencia).toMatch(/no conserva una procedencia física verificable/i);
    expect(result.items).toEqual([]);
  });

  it("no ofrece devoluciones para documentos que no sean facturas autorizadas", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { documento_tipo: "NOTA_CREDITO", origen_tipo: "VENTA", estado: "AUTORIZADA" }, error: null,
        });
        return chain;
      }),
    } as never);

    await expect(getDevolucionesDisponibles("tenant-1", "nota-1")).resolves.toEqual({
      origenTipo: "VENTA", procedenciaVerificada: false, advertencia: null, items: [],
    });
  });
});
