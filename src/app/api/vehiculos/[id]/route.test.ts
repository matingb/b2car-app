import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { VehiculoServiceError, vehiculoService } from "../vehiculoService";
import { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../vehiculoService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../vehiculoService")>();
  return {
    ...actual,
    vehiculoService: {
      ...actual.vehiculoService,
      getById: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    },
  };
});

describe("GET /api/vehiculos/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("GET: si el vehículo no existe, devuelve 404 con mensaje de vehículo no encontrado", async () => {
    vi.mocked(vehiculoService.getById).mockResolvedValue({
      data: null,
      arreglos: [],
      error: VehiculoServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/vehiculos/v1", { method: "GET" });
    const params = Promise.resolve({ id: "v1" });

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ data: null, error: "Vehículo no encontrado" });
  });
});

describe("Mutaciones /api/vehiculos/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(vehiculoService.getById).mockResolvedValue({ data: null, arreglos: [], error: null });
    vi.mocked(vehiculoService.updateById).mockResolvedValue(
      { data: { id: "v1" }, error: null } as unknown as { data: unknown; error: null }
    );
    vi.mocked(vehiculoService.deleteById).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
  });

  it("PUT: si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/vehiculos/v1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marca: "Ford" }),
    });
    const params = Promise.resolve({ id: "v1" });

    const response = await PUT(req, { params });
    expect(response.status).toBe(200);
    expect(vehiculoService.updateById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("DELETE: si delete es exitoso, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/vehiculos/v1", { method: "DELETE" });
    const params = Promise.resolve({ id: "v1" });

    const response = await DELETE(req, { params });
    expect(response.status).toBe(200);
    expect(vehiculoService.deleteById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });
});


