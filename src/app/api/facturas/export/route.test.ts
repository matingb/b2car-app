import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "@/lib/permissions";
import { fiscalTestHeader, fiscalTestLine } from "@/lib/facturacion/reporteFiscalTestData";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), membership: vi.fn(), permissions: vi.fn(), read: vi.fn(), general: vi.fn() }));
vi.mock("@/lib/facturacion/facturacionService", () => ({ exportFacturasRows: mocks.general }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: mocks.permissions }));
vi.mock("./facturasReporteRepository", () => ({ facturasReporteRepository: { read: mocks.read } }));
vi.mock("@/supabase/server", () => ({ createClient: async () => {
  const q = { select: () => q, eq: () => q, maybeSingle: mocks.membership };
  return { auth: { getClaims: mocks.claims }, from: () => q };
} }));
import { GET } from "./route";

const fiscalUrl = (extra = "") => new Request(`https://local.test/api/facturas/export?reporte=fiscal&format=csv&desde=2026-10-01&hasta=2026-10-31${extra}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "user-a", tenant_id: "tenant-a", user_role: "editor", plan_sub: "PRO" } }, error: null });
  mocks.membership.mockResolvedValue({ data: { tenant_id: "tenant-a", rol: "editor" }, error: null });
  mocks.permissions.mockResolvedValue([Permission.FacturasView]);
  mocks.read.mockResolvedValue({ data: { headers: [fiscalTestHeader()], lines: [fiscalTestLine()], associated: [] }, error: null });
  mocks.general.mockResolvedValue([{ fecha: "2026-10-31", comprobante: "00005-00000103", tipo: "Factura A", ambiente: "PRODUCCION", estado: "AUTORIZADA", receptor: "Ficticio", documento: "0", total: 121, cae: "1", origen: "ARREGLO", origenId: "a" }]);
});
afterEach(() => vi.unstubAllEnvs());

describe("descarga fiscal autorizada", () => {
  it("exige sesión (401) antes de leer", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: null });
    expect((await GET(fiscalUrl())).status).toBe(401); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("exige membresía activa (403)", async () => {
    mocks.membership.mockResolvedValue({ data: null, error: null });
    expect((await GET(fiscalUrl())).status).toBe(403); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("exige permiso efectivo rol/plan (403)", async () => {
    mocks.permissions.mockResolvedValue([]);
    const response = await GET(fiscalUrl()); expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FEATURE_NOT_AVAILABLE_FOR_PLAN" }); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("reutiliza autorización efectiva y deriva tenant de sesión, con MIME/nombre/caché fiscal", async () => {
    const response = await GET(fiscalUrl());
    expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("reporte-fiscal-ventas-2026-10-01_2026-10-31.csv");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.permissions).toHaveBeenCalledWith(expect.anything(), "editor", "PRO");
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "tenant-a", expect.objectContaining({ desde: "2026-10-01", hasta: "2026-10-31" }), expect.any(String));
    expect(await response.text()).toContain("121.00"); expect(mocks.general).not.toHaveBeenCalled();
  });
  it.each(["&tenantId=tenant-b", "&search=otro", "&estado=RECHAZADA", "&desde=2026-01-01", "&ambiente=PRODUCCION", "&ambiente=HOMOLOGACION"])("rechaza alcance incompatible o duplicado: %s", async extra => {
    expect((await GET(fiscalUrl(extra))).status).toBe(422); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rechaza modalidad y formato desconocidos", async () => {
    expect((await GET(new Request("https://local.test/api/facturas/export?reporte=otro"))).status).toBe(422);
    expect((await GET(new Request(fiscalUrl().url.replace("format=csv", "format=pdf")))).status).toBe(422);
  });
  it("XLSX contiene resumen y detalle y MIME correcto", async () => {
    const response = await GET(new Request(fiscalUrl().url.replace("format=csv", "format=xlsx")));
    expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await response.arrayBuffer());
    expect(workbook.worksheets.map(s => s.name)).toEqual(["Resumen", "Comprobantes"]);
  });
  it.each(["HOMOLOGACION", "PRODUCCION"] as const)("resuelve %s desde el servidor y lo identifica en el XLSX", async ambiente => {
    vi.stubEnv("ARCA_AMBIENTE", ambiente);
    const response = await GET(new Request(fiscalUrl().url.replace("format=csv", "format=xlsx")));
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "tenant-a", expect.objectContaining({ ambiente }), expect.any(String));
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await response.arrayBuffer());
    expect(workbook.getWorksheet("Resumen")!.getColumn(2).values).toContain(`Autorizados · ${ambiente === "PRODUCCION" ? "Producción" : "Homologación"} · Facturas / NC / ND (incluye FCE)`);
  });
  it("errores de lectura y generación devuelven JSON de error sin archivo parcial", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: new Error("fallo") });
    let response = await GET(fiscalUrl()); expect(response.status).toBe(500); expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    mocks.read.mockResolvedValueOnce({ data: { headers: [fiscalTestHeader({ total: "90071992547409.92" })], lines: [], associated: [] }, error: null });
    response = await GET(fiscalUrl()); expect(response.status).toBe(500); expect(response.headers.get("Content-Type")).toContain("application/json");
  });
  it("exportación general conserva filtros y contrato CSV/XLSX", async () => {
    const response = await GET(new Request("https://local.test/api/facturas/export?format=csv&estado=RECHAZADA&ambiente=HOMOLOGACION&search=texto"));
    expect(response.status).toBe(200);
    expect(mocks.general).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ estado: "RECHAZADA", ambiente: "HOMOLOGACION", search: "texto" }));
    expect(await response.text()).toContain("fecha,comprobante,tipo,ambiente,estado,receptor,documento,total,cae,origen,origenId");
    const excel = await GET(new Request("https://local.test/api/facturas/export?format=xlsx"));
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await excel.arrayBuffer());
    expect(workbook.worksheets.map(s => s.name)).toEqual(["Comprobantes"]);
    expect(workbook.getWorksheet(1)?.columnCount).toBe(11); expect(mocks.read).not.toHaveBeenCalled();
  });
});
