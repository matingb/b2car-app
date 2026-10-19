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
import { issueFacturaElectronica, issueVentaElectronica, type FacturaIssueInput } from "./facturacionService";
import type { TenantActor } from "./serverAuth";

type Row = Record<string, unknown>;
const actor: TenantActor = { tenantId: "tenant", userId: "user", role: "admin", claimedRole: "admin", claimedPlan: "PRO" };
const issue = { ARREGLO: issueFacturaElectronica, VENTA: issueVentaElectronica };
const anonymousReceiver = {
  clienteId: null, nombre: "Consumidor final", domicilio: null,
  tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5,
};

function mockBillingDatabase(threshold = 1000) {
  const invoices: Row[] = [];
  const tables: Record<string, Row[]> = {
    facturacion_configuracion_ambiente: [{
      ambiente: "HOMOLOGACION", razon_social: "Taller", cuit: "20123456786",
      domicilio: "Calle 1", inicio_actividades: "2020-01-01", punto_venta: 1,
      condicion_iva_emisor: "MONOTRIBUTISTA", cert_storage_path: "cert.pem", key_storage_path: "key.pem",
    }],
    arreglos: [{ id: "source", vehiculo_id: "vehicle", precio_final: 100, estado: "TERMINADO" }],
    vehiculos: [{ cliente_id: "client" }],
    detalle_arreglo: [{ id: "service", descripcion: "Servicio", cantidad: 1, horas_facturadas: 1, precio_hora_facturada: 100 }],
    operaciones: [{ id: "source", tipo: "VENTA", cliente_id: "client" }],
    operaciones_lineas: [{ id: "line", operacion_id: "source", stock_id: "stock", cantidad: 1, delta_cantidad: -1, monto_unitario: 100 }],
    stocks: [{ id: "stock", producto_id: "product", taller_id: "workshop" }],
    productos: [{ id: "product", nombre: "Repuesto" }],
    clientes: [{ id: "client", tipo_cliente: "particular" }],
    particulares: [{ nombre: "Juan", apellido: "Pérez", direccion: "Domicilio privado", dni_cuil: "12345678" }],
    facturacion_parametros_normativos: [{ valor_numerico: threshold }],
    facturas_electronicas: invoices,
    facturacion_emision_intentos: [{ id: "attempt" }],
  };
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
    for (const method of ["select", "order", "limit", "in", "lte", "insert", "upsert"]) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.eq = vi.fn((key: string, value: unknown) => { filters[key] = value; return chain; });
    chain.update = vi.fn((value: Row) => { update = value; return chain; });
    chain.maybeSingle = chain.single = vi.fn(async () => result(true));
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return chain;
  });
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "rpc_facturacion_preparar_documento") {
      invoices.push({ ...(args.p_encabezado as Row), id: "invoice", estado: "ENVIANDO" });
      return { data: "invoice", error: null };
    }
    return { data: true, error: null };
  });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as never);
  return { invoices, from, rpc, tables };
}

describe("emisión a consumidor final sin identificar", () => {
  const gateway = {
    getLastVoucher: vi.fn().mockResolvedValue(0),
    createVoucher: vi.fn().mockResolvedValue({ CAE: "12345678901234", CAEFchVto: "20991231" }),
    getVoucherInfo: vi.fn().mockResolvedValue(null),
    getVoucherTypes: vi.fn().mockResolvedValue([]),
    getSalesPoints: vi.fn().mockResolvedValue([]),
    getServerStatus: vi.fn().mockResolvedValue({}),
    getFceMipymeRequirement: vi.fn().mockResolvedValue({ obligado: false, montoDesde: null }),
  };
  let input: FacturaIssueInput;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createArcaGateway).mockResolvedValue(gateway);
    // A registered DNI must never cause a lookup (or a multiple-CUIL error) in this mode.
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({ status: "MULTIPLE", candidates: [] });
    const date = toISODateAppTimeZone(new Date());
    input = {
      idempotencyKey: "key", ambiente: "HOMOLOGACION", condicionVenta: "CONTADO",
      detalleSimplificado: false, fceSistema: null, fcePreflightConfirmada: false,
      receptor: { tipoDocumento: 99, numeroDocumento: "", condicionIvaReceptorId: 5 },
      fechas: { fechaComprobante: date, fechaServicioDesde: date, fechaServicioHasta: date, fechaVencimientoPago: date },
    };
  });

  it.each(["ARREGLO", "VENTA"] as const)("%s: envía y guarda un receptor anónimo aunque el cliente tenga DNI", async (origin) => {
    const { invoices, from } = mockBillingDatabase();

    const result = await issue[origin](actor, "source", input);

    expect(result).toMatchObject({ httpStatus: 201, invoice: { estado: "AUTORIZADA", receptorNombre: "Consumidor final" } });
    expect(invoices[0].receptor_snapshot).toEqual(anonymousReceiver);
    expect(invoices[0][origin === "ARREGLO" ? "arreglo_id" : "operacion_id"]).toBe("source");
    expect(gateway.createVoucher).toHaveBeenCalledWith(expect.objectContaining({ DocTipo: 99, DocNro: 0, CondicionIVAReceptorId: 5 }));
    expect(from.mock.calls.map(([table]) => table)).not.toContain("clientes");
    expect(lookupArcaPadronPerson).not.toHaveBeenCalled();
    expect(lookupArcaInscriptionVatCondition).not.toHaveBeenCalled();
    expect(gateway.getFceMipymeRequirement).not.toHaveBeenCalled();
  });

  it.each(["ARREGLO", "VENTA"] as const)("%s: exige identificación al alcanzar el umbral", async (origin) => {
    const { rpc } = mockBillingDatabase(100);

    await expect(issue[origin](actor, "source", input)).rejects.toThrow("Por el monto del comprobante debe identificar al consumidor final");

    expect(rpc).not.toHaveBeenCalled();
    expect(gateway.createVoucher).not.toHaveBeenCalled();
  });

  it("rechaza documento 99 con una condición IVA distinta de consumidor final", async () => {
    const { rpc } = mockBillingDatabase();
    input.receptor.condicionIvaReceptorId = 1;

    await expect(issue.VENTA(actor, "source", input)).rejects.toThrow("debe identificarse con CUIT");

    expect(rpc).not.toHaveBeenCalled();
    expect(gateway.createVoucher).not.toHaveBeenCalled();
  });

  it.each(["ARREGLO", "VENTA"] as const)("%s: conserva el perfil fiscal del cliente al emitir identificado", async (origin) => {
    const { invoices } = mockBillingDatabase();
    input.receptor = { tipoDocumento: 86, numeroDocumento: "20123456786", condicionIvaReceptorId: 5 };
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "20123456786", tipoPersona: "FISICA", estadoClave: "ACTIVO",
        nombre: "Juan", apellido: "Pérez", razonSocial: null,
        nombreCompleto: "Juan Pérez", direccion: "Domicilio fiscal",
      },
    });
    vi.mocked(lookupArcaInscriptionVatCondition).mockResolvedValue({
      status: "FOUND", condition: { cuit: "20123456786", condicionIvaReceptorId: 5, condicionIvaLabel: "Consumidor final" },
    });

    const result = await issue[origin](actor, "source", input);

    expect(result.httpStatus).toBe(201);
    expect(invoices[0].receptor_snapshot).toEqual({
      clienteId: "client", nombre: "Juan Pérez", domicilio: "Domicilio fiscal",
      tipoDocumento: 86, numeroDocumento: "20123456786", condicionIvaReceptorId: 5,
    });
    expect(lookupArcaPadronPerson).toHaveBeenCalledWith(96, "12345678");
    expect(gateway.createVoucher).toHaveBeenCalledWith(expect.objectContaining({ DocTipo: 86, DocNro: 20123456786 }));
  });

  it.each(["ARREGLO", "VENTA"] as const)("%s: emite y persiste el CUIT y la condición IVA ingresados aunque difieran del cliente", async (origin) => {
    const { invoices, from, tables } = mockBillingDatabase();
    tables.facturacion_configuracion_ambiente[0].condicion_iva_emisor = "RESPONSABLE_INSCRIPTO";
    input.receptor = { tipoDocumento: 80, numeroDocumento: "30-71234567-1", condicionIvaReceptorId: 1 };
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "20123456786", tipoPersona: "FISICA", estadoClave: "ACTIVO",
        nombre: "Juan", apellido: "Pérez", razonSocial: null,
        nombreCompleto: "Juan Pérez", direccion: "Domicilio fiscal",
      },
    });
    vi.mocked(lookupArcaInscriptionVatCondition).mockResolvedValue({
      status: "FOUND", condition: { cuit: "20123456786", condicionIvaReceptorId: 5, condicionIvaLabel: "Consumidor final" },
    });

    const result = await issue[origin](actor, "source", input);

    expect(result).toMatchObject({ httpStatus: 201, invoice: { receptorDocumento: "30712345671", claseComprobante: "A" } });
    expect(invoices[0].receptor_snapshot).toMatchObject({
      clienteId: "client", tipoDocumento: 80, numeroDocumento: "30712345671", condicionIvaReceptorId: 1,
    });
    expect(gateway.createVoucher).toHaveBeenCalledWith(expect.objectContaining({
      DocTipo: 80, DocNro: 30712345671, CondicionIVAReceptorId: 1, CbteTipo: 1,
    }));
    expect(gateway.getFceMipymeRequirement).toHaveBeenCalledWith("30712345671", input.fechas.fechaComprobante);
    for (const [index, [table]] of from.mock.calls.entries()) {
      if (table === "clientes" || table === "particulares") {
        const query = from.mock.results[index].value;
        expect(query.update).not.toHaveBeenCalled();
      }
    }
  });

  it.each(["ARREGLO", "VENTA"] as const)("%s: rechaza el CUIT ingresado inválido sin reemplazarlo por el del cliente", async (origin) => {
    const { rpc } = mockBillingDatabase();
    input.receptor = { tipoDocumento: 80, numeroDocumento: "30712345670", condicionIvaReceptorId: 1 };
    vi.mocked(lookupArcaPadronPerson).mockResolvedValue({
      status: "FOUND",
      person: {
        cuit: "20123456786", tipoPersona: "FISICA", estadoClave: "ACTIVO",
        nombre: "Juan", apellido: "Pérez", razonSocial: null,
        nombreCompleto: "Juan Pérez", direccion: "Domicilio fiscal",
      },
    });
    vi.mocked(lookupArcaInscriptionVatCondition).mockResolvedValue({
      status: "FOUND", condition: { cuit: "20123456786", condicionIvaReceptorId: 5, condicionIvaLabel: "Consumidor final" },
    });

    await expect(issue[origin](actor, "source", input)).rejects.toThrow("El CUIT o CUIL no es válido");

    expect(rpc).not.toHaveBeenCalled();
    expect(gateway.createVoucher).not.toHaveBeenCalled();
  });
});
