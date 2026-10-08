import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/arcaPadron/arcaPadronGateway", () => ({ lookupArcaPadronPerson: vi.fn() }));
vi.mock("@/lib/arcaInscripcion/arcaInscripcionGateway", () => ({ lookupArcaInscriptionVatCondition: vi.fn() }));
vi.mock("@/lib/facturacion/afipGateway", () => ({ createArcaGateway: vi.fn(), sanitizeFiscalPayload: vi.fn() }));

import { ApiError } from "@/app/api/apiError";
import { supabaseQueryMock } from "@/tests/supabaseQueryMock";
import { listDocumentos } from "./documentosService";

const TENANT = "11111111-1111-4111-8111-111111111111";

function factura(id: string, fecha: string, createdAt: string, documentoTipo = "FACTURA") {
  return {
    id, estado: "AUTORIZADA", ambiente: "HOMOLOGACION", origen_tipo: "ARREGLO", arreglo_id: "a1", operacion_id: null,
    documento_tipo: documentoTipo, clase_comprobante: "C", tipo_comprobante: 11, punto_venta: 1, numero_comprobante: 7,
    cae: "1", cae_vencimiento: fecha, total: 1000, concepto: 1, fecha_comprobante: fecha,
    receptor_snapshot: { nombre: "Cliente", numeroDocumento: "30111222" }, created_at: createdAt,
  };
}

function remito(id: string, fecha: string, createdAt: string) {
  return {
    id, clase: "X", punto_emision: 1, numero: 3, fecha_emision: fecha, ambiente: "HOMOLOGACION",
    destinatario_snapshot: { nombre: "Juan" }, factura_id: null, created_at: createdAt, factura: null,
  };
}

function calls(mock: ReturnType<typeof supabaseQueryMock>, table: string) {
  return (mock.calls[table] ?? []).map((call) => [call.method, ...call.args]);
}

describe("listDocumentos", () => {
  it("intercala facturas, notas y remitos por fecha y momento de creación", async () => {
    const mock = supabaseQueryMock({
      facturas_electronicas: [{
        data: [
          factura("f2", "2026-10-06", "2026-10-06T15:00:00+00:00"),
          factura("nc1", "2026-10-04", "2026-10-04T10:00:00+00:00", "NOTA_CREDITO"),
        ],
        error: null,
        count: 2,
      }],
      remitos: [{
        data: [
          remito("r2", "2026-10-06", "2026-10-06T18:00:00+00:00"),
          remito("r1", "2026-10-05", "2026-10-05T09:00:00+00:00"),
        ],
        error: null,
        count: 2,
      }],
    });

    const result = await listDocumentos(mock.supabase, TENANT, {});

    expect(result.total).toBe(4);
    expect(result.items.map((item) => `${item.tipo}:${item.id}`)).toEqual(["REMITO:r2", "FISCAL:f2", "REMITO:r1", "FISCAL:nc1"]);
    expect(result.items[1]).toMatchObject({ tipo: "FISCAL", fecha: "2026-10-06", factura: { documentoTipo: "FACTURA", total: 1000 } });
    expect(result.items[0]).toMatchObject({ tipo: "REMITO", remito: { numeroVisible: "X 00001-00000003" } });
    expect(calls(mock, "facturas_electronicas")).toEqual(expect.arrayContaining([["eq", "tenant_id", TENANT], ["range", 0, 24]]));
    expect(calls(mock, "remitos")).toEqual(expect.arrayContaining([["eq", "tenant_id", TENANT], ["range", 0, 24]]));
  });

  it("pagina sobre el listado combinado leyendo los documentos previos de ambas fuentes", async () => {
    const fiscales = Array.from({ length: 12 }, (_, index) =>
      factura(`f${index}`, `2026-09-${String(28 - index * 2).padStart(2, "0")}`, "2026-09-01T00:00:00+00:00"));
    const remitos = Array.from({ length: 12 }, (_, index) =>
      remito(`r${index}`, `2026-09-${String(27 - index * 2).padStart(2, "0")}`, "2026-09-01T00:00:00+00:00"));
    const mock = supabaseQueryMock({
      facturas_electronicas: [{ data: fiscales, error: null, count: 30 }],
      remitos: [{ data: remitos, error: null, count: 15 }],
    });

    const result = await listDocumentos(mock.supabase, TENANT, { page: 2, pageSize: 10 });

    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 45 });
    expect(result.items.map((item) => item.id)).toEqual(["f5", "r5", "f6", "r6", "f7", "r7", "f8", "r8", "f9", "r9"]);
    expect(calls(mock, "facturas_electronicas")).toContainEqual(["range", 0, 19]);
    expect(calls(mock, "remitos")).toContainEqual(["range", 0, 19]);
  });

  it("filtra solo remitos con sus filtros propios sin consultar comprobantes fiscales", async () => {
    const mock = supabaseQueryMock({ remitos: [{ data: [], error: null, count: 0 }] });

    await listDocumentos(mock.supabase, TENANT, {
      tipo: "REMITO", clase: "R", factura: "sin", ambiente: "PRODUCCION", desde: "2026-10-01", hasta: "2026-10-31", search: "R 00001-00000008",
    });

    expect(mock.from).not.toHaveBeenCalledWith("facturas_electronicas");
    expect(calls(mock, "remitos")).toEqual(expect.arrayContaining([
      ["eq", "ambiente", "PRODUCCION"],
      ["eq", "clase", "R"],
      ["is", "factura_id", null],
      ["gte", "fecha_emision", "2026-10-01"],
      ["lte", "fecha_emision", "2026-10-31"],
      ["or", expect.stringContaining("and(numero.eq.8,punto_emision.eq.1,clase.eq.R)")],
    ]));
  });

  it("filtra comprobantes fiscales por tipo y estado sin consultar remitos", async () => {
    const mock = supabaseQueryMock({ facturas_electronicas: [{ data: [], error: null, count: 0 }] });

    await listDocumentos(mock.supabase, TENANT, { tipo: "NOTA_CREDITO", estado: "AUTORIZADA", search: "00001-00000007" });

    expect(mock.from).not.toHaveBeenCalledWith("remitos");
    expect(calls(mock, "facturas_electronicas")).toEqual(expect.arrayContaining([
      ["eq", "documento_tipo", "NOTA_CREDITO"],
      ["eq", "estado", "AUTORIZADA"],
      ["or", expect.stringContaining("and(punto_venta.eq.1,numero_comprobante.eq.7)")],
    ]));
  });

  it.each([
    [{ estado: "AUTORIZADA" }, "facturas_electronicas", "remitos"],
    [{ clase: "X" }, "remitos", "facturas_electronicas"],
    [{ factura: "con" }, "remitos", "facturas_electronicas"],
  ])("con %o consulta solo %s", async (filtros, consultada, omitida) => {
    const mock = supabaseQueryMock({ [consultada]: [{ data: [], error: null, count: 0 }] });
    await listDocumentos(mock.supabase, TENANT, filtros);
    expect(mock.from).toHaveBeenCalledWith(consultada);
    expect(mock.from).not.toHaveBeenCalledWith(omitida);
  });

  it.each([
    [{ tipo: "PRESUPUESTO" }, "tipo de documento"],
    [{ estado: "PAGADA" }, "estado"],
    [{ ambiente: "TEST" }, "ambiente"],
    [{ clase: "Z" }, "tipo de remito"],
    [{ factura: "quizas" }, "filtro de factura"],
    [{ desde: "2026-13-01" }, "AAAA-MM-DD"],
    [{ desde: "2026-10-10", hasta: "2026-10-01" }, "posterior"],
    [{ search: "x".repeat(101) }, "100 caracteres"],
    [{ page: 41, pageSize: 25 }, "hasta 1000 documentos"],
  ])("valida %o", async (filtros, message) => {
    const mock = supabaseQueryMock({});
    const error = await listDocumentos(mock.supabase, TENANT, filtros).catch((cause) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400 });
    expect(error.message).toContain(message);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
