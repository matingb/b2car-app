import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { emitirRemito, listRemitos } from "@/lib/remitos/remitosService";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/remitos/remitosService", () => ({ listRemitos: vi.fn(), emitirRemito: vi.fn() }));

const KEY = "3f0c8a62-4f5d-4a4e-9a70-2b8a1d6c9e01";
const REMITO_ID = "33333333-3333-4333-8333-333333333333";
const TENANT = "22222222-2222-4222-8222-222222222222";
const segment = () => ({ params: Promise.resolve({}) });
const get = (query = "") => new NextRequest(`http://localhost/api/remitos${query}`);
const post = (body: unknown) => new NextRequest("http://localhost/api/remitos", {
  method: "POST",
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const body = {
  idempotencyKey: KEY,
  clase: "X",
  destinatario: { nombre: "Juan" },
  lineas: [{ descripcion: "Rueda", cantidad: 2 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockApiSession();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("GET /api/remitos", () => {
  it("requiere facturas:view", async () => {
    mockApiSession({ permissions: [Permission.ArreglosView] });
    const response = await GET(get(), segment());
    expect(response.status).toBe(403);
    expect(listRemitos).not.toHaveBeenCalled();
  });

  it("lista con los filtros de la query y el ambiente vigente", async () => {
    vi.stubEnv("ARCA_AMBIENTE", "PRODUCCION");
    const { supabase } = mockApiSession({ permissions: [Permission.FacturasView] });
    const data = { items: [], page: 1, pageSize: 25, total: 0 };
    vi.mocked(listRemitos).mockResolvedValueOnce(data);

    const response = await GET(get("?page=2&clase=R&factura=sin&search=juan&desde=2026-10-01"), segment());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
    expect(listRemitos).toHaveBeenCalledWith(supabase, TENANT, "PRODUCCION", {
      page: 2, pageSize: 25, clase: "R", factura: "sin", desde: "2026-10-01", hasta: null, search: "juan",
    });
  });
});

describe("POST /api/remitos", () => {
  it("requiere facturas:edit", async () => {
    mockApiSession({ permissions: [Permission.FacturasView] });
    const response = await POST(post(body), segment());
    expect(response.status).toBe(403);
    expect(emitirRemito).not.toHaveBeenCalled();
  });

  it.each([
    ["{", "JSON inválido"],
    [{ ...body, clase: undefined }, "Seleccioná el tipo de remito (R o X)"],
    [{ ...body, lineas: [{ descripcion: "Rueda", cantidad: 0 }] }, "La cantidad del ítem 1"],
  ])("valida el cuerpo antes de emitir: %s", async (payload, message) => {
    const response = await POST(post(payload), segment());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(emitirRemito).not.toHaveBeenCalled();
  });

  it("emite con la entrada validada y responde 201", async () => {
    const { supabase } = mockApiSession();
    vi.mocked(emitirRemito).mockResolvedValueOnce(REMITO_ID);

    const response = await POST(post(body), segment());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: REMITO_ID }, error: null });
    expect(emitirRemito).toHaveBeenCalledWith(supabase, "HOMOLOGACION", expect.objectContaining({
      idempotencyKey: KEY,
      clase: "X",
      arregloId: null,
      facturaId: null,
      lineas: [{ facturaLineaId: null, codigo: null, descripcion: "Rueda", observaciones: null, cantidad: 2 }],
    }));
  });

  it.each([
    [{ code: "P0001", message: "Para emitir un Remito R configurá el CAI en Configuración > Facturación" }, 400, "VALIDATION", "Para emitir un Remito R configurá el CAI"],
    [{ code: "P0001", message: "Factura no encontrada" }, 404, "NOT_FOUND", "Factura no encontrada"],
    [{ code: "P0002", message: "Remito no encontrado" }, 404, "NOT_FOUND", "Remito no encontrado"],
    [{ code: "42501", message: "No tenés permiso para emitir remitos" }, 403, "FORBIDDEN", ""],
    [{ code: "55000", message: "El remito emitido es inmutable" }, 409, "INMUTABLE", "El remito emitido es inmutable"],
    [{ code: "23505", message: 'duplicate key value violates unique constraint "remitos_numero_unico"' }, 409, "CONFLICT", "El número de remito ya fue utilizado"],
  ])("mapea errores de la base %o", async (dbError, status, code, message) => {
    vi.mocked(emitirRemito).mockRejectedValueOnce(dbError);

    const response = await POST(post(body), segment());

    expect(response.status).toBe(status);
    const json = await response.json();
    expect(json.code).toBe(code);
    expect(json.error).toContain(message);
  });
});
