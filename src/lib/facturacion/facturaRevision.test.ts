import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));
vi.mock("@/lib/arcaInscripcion/arcaInscripcionGateway", () => ({ lookupArcaInscriptionVatCondition: vi.fn() }));
vi.mock("./credentialStorage", () => ({ downloadCredentialPair: vi.fn().mockResolvedValue({ cert: "cert", key: "key" }) }));
vi.mock("./afipGateway", () => ({ createArcaGateway: vi.fn(), sanitizeFiscalPayload: (value: unknown) => value }));

import { createClient } from "@/supabase/server";
import { lookupArcaPadronPerson } from "@/lib/arcaPadron/arcaPadronGateway";
import { lookupArcaInscriptionVatCondition } from "@/lib/arcaInscripcion/arcaInscripcionGateway";
import { toISODateAppTimeZone } from "@/lib/fechas";
import { createArcaGateway } from "./afipGateway";
import { FceMipymeQueryError } from "./fceMipyme";
import {
  buildFacturaDraftPdf,
  FacturaRevisionDesactualizadaError,
  getFacturaPreflight,
  getReceptorPrecarga,
  issueFacturaElectronica,
  issueVentaElectronica,
  normalizedFacturaIntent,
  parseFacturaIssueInput,
  parseFacturaPreviewRequest,
  previewSourceFactura,
  resolvePdfReceiverSnapshot,
  type FacturaDraftInput,
  type FacturaIssueInput,
} from "./facturacionService";
import type { TenantActor } from "./serverAuth";

type Row = Record<string, unknown>;
const actor: TenantActor = { tenantId: "tenant", userId: "user", role: "admin", claimedRole: "admin", claimedPlan: "PRO" };
const today = toISODateAppTimeZone(new Date());
const fechas = { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today };
const WRITE_METHODS = ["insert", "upsert", "update", "delete"] as const;

function mockBillingDatabase() {
  const invoices: Row[] = [];
  const tables: Record<string, Row[]> = {
    facturacion_configuracion_ambiente: [{
      ambiente: "HOMOLOGACION", razon_social: "Taller", cuit: "20123456786",
      domicilio: "Calle 1", inicio_actividades: "2020-01-01", punto_venta: 1,
      condicion_iva_emisor: "MONOTRIBUTISTA", cert_storage_path: "cert.pem", key_storage_path: "key.pem",
      ingresos_brutos_condicion: "EXENTO",
    }],
    arreglos: [{ id: "source", vehiculo_id: "vehicle", precio_final: 100, estado: "TERMINADO" }],
    vehiculos: [{ cliente_id: "client" }],
    detalle_arreglo: [{ id: "service", descripcion: "Cambio de aceite", cantidad: 1, horas_facturadas: 1, precio_hora_facturada: 60 },
      { id: "service-2", descripcion: "Alineación <rápida> & balanceo", cantidad: 1, horas_facturadas: 1, precio_hora_facturada: 40 }],
    operaciones: [{ id: "source", tipo: "VENTA", cliente_id: "client" }],
    operaciones_lineas: [{ id: "line", operacion_id: "source", stock_id: "stock", cantidad: 1, delta_cantidad: -1, monto_unitario: 100 }],
    stocks: [{ id: "stock", producto_id: "product", taller_id: "workshop" }],
    productos: [{ id: "product", nombre: "Repuesto" }],
    clientes: [{ id: "client", tipo_cliente: "particular" }],
    particulares: [{ nombre: "Juan", apellido: "Pérez", direccion: "Domicilio de la ficha", dni_cuil: "12345678" }],
    facturacion_parametros_normativos: [{ valor_numerico: 1000 }],
    facturas_electronicas: invoices,
    facturacion_emision_intentos: [{ id: "attempt" }],
  };
  const writes: Array<{ table: string; method: string }> = [];
  const from = vi.fn((table: string) => {
    const filters: Row = {};
    let update: Row | undefined;
    const chain: Record<string, unknown> = {};
    const result = (single = false) => {
      const rows = (tables[table] ?? []).filter((row) => table !== "facturas_electronicas"
        || Object.entries(filters).every(([key, value]) => row[key] === value));
      if (update) rows.forEach((row) => Object.assign(row, update));
      return { data: single ? rows[0] ?? null : rows, error: null, count: 0 };
    };
    for (const method of ["select", "order", "limit", "in", "lte"]) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    for (const method of WRITE_METHODS) {
      chain[method] = vi.fn((value?: Row) => {
        writes.push({ table, method });
        if (method === "update") update = value;
        return chain;
      });
    }
    chain.eq = vi.fn((key: string, value: unknown) => { filters[key] = value; return chain; });
    chain.maybeSingle = chain.single = vi.fn(async () => result(true));
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return chain;
  });
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "rpc_facturacion_preparar_documento") {
      invoices.push({ ...(args.p_encabezado as Row), id: "invoice", estado: "ENVIANDO", lineas: args.p_lineas });
      return { data: "invoice", error: null };
    }
    return { data: true, error: null };
  });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as never);
  return { invoices, from, rpc, tables, writes };
}

const gateway = {
  getLastVoucher: vi.fn(),
  createVoucher: vi.fn(),
  getVoucherInfo: vi.fn(),
  getVoucherTypes: vi.fn(),
  getSalesPoints: vi.fn(),
  getServerStatus: vi.fn(),
  getFceMipymeRequirement: vi.fn(),
};

function draft(overrides: Partial<FacturaDraftInput["receptor"]> = {}, extra: Partial<FacturaDraftInput> = {}): FacturaDraftInput {
  return {
    ambiente: "HOMOLOGACION", condicionVenta: "CONTADO", detalleSimplificado: false, fceSistema: null,
    receptor: {
      modo: "CLIENTE", nombre: "Juan Pérez", domicilio: "Domicilio revisado 123",
      tipoDocumento: 86, numeroDocumento: "20123456786", condicionIvaReceptorId: 5,
      ...overrides,
    },
    fechas,
    ...extra,
  };
}

function issueInput(input: FacturaDraftInput, revisionHash?: string): FacturaIssueInput {
  return {
    ...input, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", fcePreflightConfirmada: false,
    ...(revisionHash ? { revisionHash } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  gateway.getLastVoucher.mockResolvedValue(0);
  gateway.createVoucher.mockResolvedValue({ CAE: "12345678901234", CAEFchVto: "20991231" });
  gateway.getVoucherInfo.mockResolvedValue(null);
  gateway.getFceMipymeRequirement.mockResolvedValue({ obligado: false, montoDesde: null });
  vi.mocked(createArcaGateway).mockResolvedValue(gateway as never);
  vi.mocked(lookupArcaPadronPerson).mockRejectedValue(new Error("La revisión no debe consultar el padrón"));
  vi.mocked(lookupArcaInscriptionVatCondition).mockRejectedValue(new Error("La revisión no debe consultar la constancia"));
});

describe("revisión previa sin efectos de emisión", () => {
  it("prepara el comprobante con la identidad revisada del cliente sin numerar, emitir ni escribir", async () => {
    const { rpc, writes } = mockBillingDatabase();

    const { revision, issues } = await previewSourceFactura(actor, "ARREGLO", "source", draft());

    expect(issues).toEqual([]);
    expect(revision).toMatchObject({
      receptorModo: "CLIENTE",
      clienteAsociado: { clienteId: "client", nombre: "Juan Pérez", documento: "12345678" },
      receptor: {
        clienteId: "client", nombre: "Juan Pérez", domicilio: "Domicilio revisado 123",
        tipoDocumento: 86, numeroDocumento: "20123456786", condicionIvaReceptorId: 5, identidadRevisada: true,
      },
      claseComprobante: "C", tipoComprobante: 11, concepto: 2, fce: null,
      emisor: { razonSocial: "Taller", cuit: "20123456786", puntoVenta: 1 },
      totales: { total: 100 },
      fechas: { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today },
    });
    expect(revision?.revisionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(revision?.lineas.map((line) => line.descripcion)).toEqual(["Cambio de aceite", "Alineación <rápida> & balanceo"]);
    expect(rpc).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    expect(gateway.getLastVoucher).not.toHaveBeenCalled();
    expect(gateway.createVoucher).not.toHaveBeenCalled();
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("factura a otro CUIT sin heredar ni modificar al cliente del arreglo", async () => {
    const { writes } = mockBillingDatabase();
    const otro = draft({ modo: "OTRO", nombre: "Otra Empresa SA", domicilio: null, tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 });

    const { revision } = await previewSourceFactura(actor, "ARREGLO", "source", otro);

    expect(revision?.receptor).toEqual({
      clienteId: null, nombre: "Otra Empresa SA", domicilio: null,
      tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1, identidadRevisada: true,
    });
    expect(revision?.clienteAsociado).toMatchObject({ clienteId: "client", nombre: "Juan Pérez" });
    expect(gateway.getFceMipymeRequirement).toHaveBeenCalledWith("30712345671", today);
    expect(writes).toEqual([]);
  });

  it("devuelve juntos los errores independientes sin consultar FCE con un documento inválido", async () => {
    mockBillingDatabase();
    const invalid = draft(
      { modo: "OTRO", nombre: "  ", tipoDocumento: 80, numeroDocumento: "30712345670", condicionIvaReceptorId: 1 },
      { detalleSimplificado: true, descripcionDetalleSimplificado: " ", fechas: { ...fechas, fechaServicioDesde: "2020-01-01", fechaComprobante: "fecha" } },
    );

    const { revision, issues } = await previewSourceFactura(actor, "ARREGLO", "source", invalid);

    expect(revision).toBeNull();
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ grupo: "DETALLE", campo: "detalle.descripcion", severidad: "error" }),
      expect.objectContaining({ grupo: "RECEPTOR", campo: "receptor.nombre", severidad: "error" }),
      expect.objectContaining({ grupo: "RECEPTOR", campo: "receptor.numeroDocumento", mensaje: "El CUIT o CUIL no es válido" }),
      expect.objectContaining({ grupo: "COMPROBANTE", campo: "fechas.fechaComprobante" }),
    ]));
    expect(gateway.getFceMipymeRequirement).not.toHaveBeenCalled();
  });

  it("no vincula al cliente del arreglo un documento de otra persona", async () => {
    mockBillingDatabase();

    const { revision, issues } = await previewSourceFactura(actor, "ARREGLO", "source", draft({ tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 }));

    expect(revision).toBeNull();
    expect(issues).toEqual([expect.objectContaining({ codigo: "DOCUMENTO_NO_CORRESPONDE_AL_CLIENTE", campo: "receptor.numeroDocumento" })]);
  });

  it("anonimiza al consumidor final aunque el formulario envíe datos previos", async () => {
    mockBillingDatabase();

    const { revision } = await previewSourceFactura(actor, "VENTA", "source", draft({ tipoDocumento: 99, numeroDocumento: "12345678", nombre: "Juan Pérez", domicilio: "Privado" }));

    expect(revision?.receptor).toEqual({
      clienteId: null, nombre: "Consumidor final", domicilio: null,
      tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5, identidadRevisada: true,
    });
  });

  it("bloquea la revisión cuando la obligación FCE no puede determinarse", async () => {
    mockBillingDatabase();
    gateway.getFceMipymeRequirement.mockRejectedValue(new FceMipymeQueryError());

    const { revision, issues } = await previewSourceFactura(actor, "ARREGLO", "source", draft({ modo: "OTRO", nombre: "Otra Empresa SA", tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 }));

    expect(revision).toBeNull();
    expect(issues).toEqual([expect.objectContaining({ codigo: "FCE_INDETERMINADA", grupo: "CONFIGURACION", severidad: "error" })]);
  });

  it("informa una FCE con configuración incompleta y la presenta como FCE", async () => {
    const { tables } = mockBillingDatabase();
    gateway.getFceMipymeRequirement.mockResolvedValue({ obligado: true, montoDesde: 50 });
    tables.facturacion_configuracion_ambiente[0].fce_cbu = "1234567890123456789012";
    tables.facturacion_configuracion_ambiente[0].fce_sistema = "SCA";

    const { revision } = await previewSourceFactura(actor, "ARREGLO", "source", draft({ modo: "OTRO", nombre: "Otra Empresa SA", tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 }));

    expect(revision).toMatchObject({ tipoComprobante: 211, fce: { sistema: "SCA", cbu: "1234567890123456789012" } });

    delete tables.facturacion_configuracion_ambiente[0].fce_cbu;
    const missing = await previewSourceFactura(actor, "ARREGLO", "source", draft({ modo: "OTRO", nombre: "Otra Empresa SA", tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 }));
    expect(missing.issues).toEqual([expect.objectContaining({ codigo: "FCE_SIN_CONFIGURAR", grupo: "CONFIGURACION" })]);
  });

  it("no revisa un origen que ya tiene una factura autorizada", async () => {
    const { invoices } = mockBillingDatabase();
    invoices.push({ tenant_id: "tenant", ambiente: "HOMOLOGACION", documento_tipo: "FACTURA", arreglo_id: "source", estado: "AUTORIZADA" });

    const { revision, issues } = await previewSourceFactura(actor, "ARREGLO", "source", draft());

    expect(revision).toBeNull();
    expect(issues).toEqual([expect.objectContaining({ codigo: "FACTURA_YA_AUTORIZADA", grupo: "EMISION" })]);
  });
});

describe("emisión de una revisión confirmada", () => {
  it.each([
    ["ARREGLO", issueFacturaElectronica],
    ["VENTA", issueVentaElectronica],
  ] as const)("%s: persiste exactamente el receptor revisado y el texto simplificado", async (origin, issue) => {
    const { invoices } = mockBillingDatabase();
    const reviewed = draft(
      { modo: "OTRO", nombre: "Otra Empresa SA", domicilio: "Av. Revisada 456", tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1 },
      origin === "ARREGLO" ? { detalleSimplificado: true, descripcionDetalleSimplificado: "Service completo 10.000 km" } : {},
    );
    const { revision } = await previewSourceFactura(actor, origin, "source", reviewed);

    const result = await issue(actor, "source", issueInput(reviewed, revision!.revisionHash));

    expect(result).toMatchObject({ httpStatus: 201, invoice: { estado: "AUTORIZADA", receptorNombre: "Otra Empresa SA" } });
    expect(invoices[0].receptor_snapshot).toEqual(revision!.receptor);
    expect(invoices[0].total).toBe(revision!.totales.total);
    const lines = invoices[0].lineas as Row[];
    expect(lines.map((line) => line.descripcion)).toEqual(revision!.lineas.map((line) => line.descripcion));
    if (origin === "ARREGLO") {
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ descripcion: "Service completo 10.000 km", importe_total: 100 });
      expect((lines[0].snapshot as Row).lineasOriginales).toHaveLength(2);
    }
    // La obligación FCE se resolvió al preparar y no se consulta otra vez al emitir.
    expect(gateway.getFceMipymeRequirement).toHaveBeenCalledTimes(2);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("pide una revisión nueva si el origen cambió, antes de numerar o preparar el documento", async () => {
    const { tables, rpc } = mockBillingDatabase();
    const reviewed = draft();
    const { revision } = await previewSourceFactura(actor, "ARREGLO", "source", reviewed);
    // Mismo total, otro detalle: la huella cubre líneas y descripciones, no sólo el monto.
    tables.detalle_arreglo[1].descripcion = "Alineación";

    await expect(issueFacturaElectronica(actor, "source", issueInput(reviewed, revision!.revisionHash)))
      .rejects.toBeInstanceOf(FacturaRevisionDesactualizadaError);

    expect(rpc).not.toHaveBeenCalled();
    expect(gateway.getLastVoucher).not.toHaveBeenCalled();
    expect(gateway.createVoucher).not.toHaveBeenCalled();
  });
});

describe("PDF borrador de la revisión", () => {
  it("genera el borrador del contenido revisado sin guardar archivos ni filas", async () => {
    const { writes, rpc } = mockBillingDatabase();
    const reviewed = draft();
    const { revision } = await previewSourceFactura(actor, "ARREGLO", "source", reviewed);

    const pdf = await buildFacturaDraftPdf(actor, { origenTipo: "ARREGLO", origenId: "source", draft: reviewed, revisionHash: revision!.revisionHash });

    expect(Buffer.from(pdf.bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect((await PDFDocument.load(pdf.bytes)).getTitle()).toContain("BORRADOR");
    expect(pdf.filename).toBe("borrador-factura-c.pdf");
    expect(writes).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no entrega el PDF de otra revisión", async () => {
    mockBillingDatabase();

    await expect(buildFacturaDraftPdf(actor, { origenTipo: "ARREGLO", origenId: "source", draft: draft(), revisionHash: "0".repeat(64) }))
      .rejects.toBeInstanceOf(FacturaRevisionDesactualizadaError);
  });
});

describe("contrato del formulario de factura", () => {
  const legacy = {
    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", condicionVenta: "CONTADO", detalleSimplificado: false,
    receptor: { tipoDocumento: 80, numeroDocumento: "20-12345678-6", condicionIvaReceptorId: 1 }, fechas,
  };

  it("conserva la huella histórica cuando el pedido no trae campos nuevos", () => {
    const input = parseFacturaIssueInput(legacy);
    expect(input.receptor).toEqual({ tipoDocumento: 80, numeroDocumento: "20-12345678-6", condicionIvaReceptorId: 1 });
    expect(normalizedFacturaIntent("ARREGLO", "source", input)).toEqual({
      origenTipo: "ARREGLO", origenId: "source", ambiente: "HOMOLOGACION", documentoTipo: "FACTURA",
      fechas: { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today },
      receptor: { tipoDocumento: 80, numeroDocumento: "20123456786", condicionIvaReceptorId: 1 },
      condicionVenta: "CONTADO", detalleSimplificado: false, fceSistema: null, fcePreflightConfirmada: false,
    });
  });

  it("incluye identidad y texto efectivos en la intención, pero no la huella de revisión", () => {
    const hash = (value: unknown) => createHash("sha256")
      .update(JSON.stringify(normalizedFacturaIntent("ARREGLO", "source", parseFacturaIssueInput(value)))).digest("hex");
    const reviewed = { ...legacy, receptor: { ...legacy.receptor, modo: "OTRO", nombre: "Empresa", domicilio: null } };

    expect(hash(reviewed)).not.toBe(hash(legacy));
    expect(hash({ ...reviewed, receptor: { ...reviewed.receptor, nombre: "Otra" } })).not.toBe(hash(reviewed));
    expect(hash({ ...reviewed, revisionHash: "a".repeat(64) })).toBe(hash(reviewed));
    expect(hash({ ...reviewed, detalleSimplificado: true, descripcionDetalleSimplificado: "Texto" }))
      .not.toBe(hash({ ...reviewed, detalleSimplificado: true }));
    // Con el detalle simplificado apagado, un texto oculto no forma parte de la intención.
    expect(hash({ ...reviewed, descripcionDetalleSimplificado: "Texto" })).toBe(hash(reviewed));
  });

  it("distingue domicilio omitido de domicilio vacío y valida los campos nuevos", () => {
    expect(parseFacturaIssueInput({ ...legacy, receptor: { ...legacy.receptor, domicilio: " " } }).receptor.domicilio).toBeNull();
    expect(parseFacturaIssueInput({ ...legacy, receptor: { ...legacy.receptor, domicilio: null } }).receptor.domicilio).toBeNull();
    expect("domicilio" in parseFacturaIssueInput(legacy).receptor).toBe(false);
    expect(() => parseFacturaIssueInput({ ...legacy, receptor: { ...legacy.receptor, modo: "AMIGO" } })).toThrow("El receptor elegido no es válido");
    expect(() => parseFacturaIssueInput({ ...legacy, receptor: { ...legacy.receptor, nombre: 1 } })).toThrow("El nombre del receptor no es válido");
    expect(() => parseFacturaIssueInput({ ...legacy, revisionHash: "otra" })).toThrow("La revisión de la factura no es válida");
    expect(() => parseFacturaPreviewRequest({ ...legacy, origenTipo: "ARREGLO", origenId: "source" })).toThrow("Elegí a quién se emite la factura");
    expect(() => parseFacturaPreviewRequest({ ...legacy, origenTipo: "NOTA", origenId: "source", receptor: { modo: "CLIENTE" } })).toThrow("El origen de la factura no es válido");
  });
});

describe("precarga del formulario en dos partes", () => {
  it("prepara el formulario sin esperar las consultas del cliente a ARCA", async () => {
    mockBillingDatabase();

    const { preflight } = await getFacturaPreflight(actor, "source", "HOMOLOGACION", undefined, { receptorDiferido: true });

    expect(preflight).toMatchObject({
      receptorPendiente: true,
      clienteAsociado: { clienteId: "client", nombre: "Juan Pérez", documento: "12345678" },
      concepto: 2, total: 100, fcePosible: false,
    });
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
    expect(lookupArcaInscriptionVatCondition).not.toHaveBeenCalled();
    expect(gateway.getFceMipymeRequirement).not.toHaveBeenCalled();
  });

  it("refresca la obligación FCE del documento elegido sin volver a resolver al cliente", async () => {
    mockBillingDatabase();

    const { preflight } = await getFacturaPreflight(actor, "source", "HOMOLOGACION", { fechaComprobante: today, tipoDocumento: 80, numeroDocumento: "30712345671" });

    expect(preflight.fceObligatoria).toBe(false);
    expect(gateway.getFceMipymeRequirement).toHaveBeenCalledWith("30712345671", today);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });

  it("devuelve aparte el perfil fiscal del cliente desde la ficha y ARCA", async () => {
    mockBillingDatabase();
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "20123456786", tipoPersona: "FISICA", estadoClave: "ACTIVO", nombre: "Juan", apellido: "Pérez",
        razonSocial: null, nombreCompleto: "Juan Pérez", direccion: "Domicilio fiscal",
      },
    });
    vi.mocked(lookupArcaInscriptionVatCondition).mockResolvedValue({
      status: "FOUND", condition: { cuit: "20123456786", condicionIvaReceptorId: 5, condicionIvaLabel: "Consumidor final" },
    });

    await expect(getReceptorPrecarga(actor, "VENTA", "source")).resolves.toEqual({
      receptor: {
        clienteId: "client", nombre: "Juan Pérez", domicilio: "Domicilio fiscal",
        tipoDocumento: 86, numeroDocumento: "20123456786", condicionIvaReceptorId: 5,
      },
      clienteAsociado: { clienteId: "client", nombre: "Juan Pérez", documento: "12345678" },
    });
  });
});

describe("PDF autorizado de un receptor revisado", () => {
  it("imprime la identidad revisada sin reemplazarla por el padrón", async () => {
    const snapshot = {
      clienteId: null, nombre: "Otra Empresa SA", domicilio: null, tipoDocumento: 80,
      numeroDocumento: "30712345671", condicionIvaReceptorId: 1, identidadRevisada: true,
    };

    await expect(resolvePdfReceiverSnapshot("tenant", snapshot)).resolves.toBe(snapshot);
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
  });
});
