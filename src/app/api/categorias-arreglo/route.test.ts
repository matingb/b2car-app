import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { categoriasArregloService } from "./categoriasArregloService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { ServiceError } from "../serviceError";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({ fetchEffectivePermissions: vi.fn(), fetchPlanPermissions: vi.fn() }));
vi.mock("./categoriasArregloService", () => ({ categoriasArregloService: { list: vi.fn(), create: vi.fn() } }));
vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({ statsService: { onDataChanged: vi.fn() } }));

const segment = () => ({ params: Promise.resolve({}) });
const req = (body?: string) => new NextRequest("http://localhost/api/categorias-arreglo", body === undefined ? {} : { method: "POST", body });
const row = { id: "category-id", tenant_id: "tenant-id", nombre: "Motor", created_at: "2026-10-01", updated_at: "2026-10-01" };

beforeEach(() => {
  vi.clearAllMocks();
  mockApiSession({ permissions: [] }); // These routes never required a specific permission.
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
  vi.mocked(statsService.onDataChanged).mockResolvedValue(undefined);
});

describe("categorias-arreglo pilot", () => {
  it("requires validated claims for GET and POST", async () => {
    mockApiSession({ claims: null });
    const request = req("{");
    const read = vi.spyOn(request, "json");
    for (const response of [await GET(req(), segment()), await POST(request, segment())]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: expect.any(String), code: "UNAUTHORIZED" });
    }
    expect(categoriasArregloService.list).not.toHaveBeenCalled();
    expect(categoriasArregloService.create).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("lists without adding a required permission and validates claims once", async () => {
    const { supabase, getClaims } = mockApiSession({ permissions: [] });
    vi.mocked(categoriasArregloService.list).mockResolvedValueOnce({ data: [row], error: null });
    const response = await GET(req(), segment());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: row.id, nombre: row.nombre, created_at: row.created_at, updated_at: row.updated_at }], error: null });
    expect(categoriasArregloService.list).toHaveBeenCalledWith(supabase);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("maps the original database error when a service returns cause", async () => {
    vi.mocked(categoriasArregloService.list).mockResolvedValueOnce({
      data: [], error: ServiceError.Unknown, cause: { name: "PostgrestError", code: "42501", message: "private SQL", details: "", hint: "" },
    });
    const response = await GET(req(), segment());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    { body: "{", message: "JSON inválido" },
    { body: "null", message: "JSON inválido" },
    { body: '{"nombre":" "}', message: "Falta nombre" },
  ])("validates JSON before creating: $message", async ({ body, message }) => {
    const request = req(body);
    const read = vi.spyOn(request, "json");
    const response = await POST(request, segment());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message, code: "VALIDATION" });
    expect(categoriasArregloService.create).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("creates a trimmed category and invalidates dashboard stats", async () => {
    const { supabase } = mockApiSession({ permissions: [] });
    vi.mocked(categoriasArregloService.create).mockResolvedValueOnce({ data: row, error: null });
    const response = await POST(req('{"nombre":" Motor "}'), segment());
    expect(response.status).toBe(201);
    expect((await response.json()).data.nombre).toBe("Motor");
    expect(categoriasArregloService.create).toHaveBeenCalledWith(supabase, { nombre: "Motor" });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(supabase, "22222222-2222-4222-8222-222222222222");
  });

  it("maps duplicate names by constraint without exposing SQL", async () => {
    vi.mocked(categoriasArregloService.create).mockResolvedValueOnce({ data: null, error: {
      name: "PostgrestError", code: "23505", message: 'duplicate key violates unique constraint "uq_categorias_arreglo_tenant_nombre_lower"', details: "", hint: "",
    } });
    const response = await POST(req('{"nombre":"Motor"}'), segment());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Ya existe una categoría de arreglo con ese nombre", code: "CONFLICT" });
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("logs unexpected exceptions with a reference and returns a safe message", async () => {
    vi.mocked(categoriasArregloService.create).mockRejectedValueOnce(new Error("private SQL"));
    const response = await POST(req('{"nombre":"Motor"}'), segment());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Error creando categoría de arreglo", code: "INTERNAL", errorId: expect.any(String) });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(body.errorId), expect.objectContaining({ errorId: body.errorId }), expect.any(Error));
  });
});
