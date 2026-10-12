import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { Permission } from "@/lib/permissions";
import { listDocumentos } from "@/lib/documentos/documentosService";
import { ApiError } from "../apiError";
import { GET } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("@/lib/documentos/documentosService", () => ({ listDocumentos: vi.fn() }));

const TENANT = "22222222-2222-4222-8222-222222222222";
const segment = () => ({ params: Promise.resolve({}) });
const req = (query = "") => new NextRequest(`http://localhost/api/documentos${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
});

describe("GET /api/documentos", () => {
  it("requiere facturas:view", async () => {
    mockApiSession({ permissions: [Permission.ArreglosView] });
    expect((await GET(req(), segment())).status).toBe(403);
    expect(listDocumentos).not.toHaveBeenCalled();
  });

  it("lista con los filtros de la query", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.FacturasView] });
    const data = { items: [], page: 2, pageSize: 25, total: 0 };
    vi.mocked(listDocumentos).mockResolvedValueOnce(data);

    const response = await GET(req("?page=2&tipo=REMITO&clase=R&factura=con&ambiente=PRODUCCION&search=juan&desde=2026-10-01"), segment());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
    expect(listDocumentos).toHaveBeenCalledWith(supabase, TENANT, {
      page: 2, pageSize: 25, tipo: "REMITO", estado: null, ambiente: "PRODUCCION", desde: "2026-10-01", hasta: null,
      search: "juan", clase: "R", factura: "con",
    });
  });

  it("devuelve los errores de validación del listado", async () => {
    mockApiSession();
    vi.mocked(listDocumentos).mockRejectedValueOnce(new ApiError(400, "El tipo de documento del filtro no es válido", "VALIDATION"));
    const response = await GET(req("?tipo=OTRO"), segment());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "El tipo de documento del filtro no es válido", code: "VALIDATION" });
  });
});
