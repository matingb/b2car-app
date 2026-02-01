import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { vehiculoService } from "../../vehiculoService";
import { NextRequest } from "next/server";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../../vehiculoService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../vehiculoService")>();
  return {
    ...actual,
    vehiculoService: {
      ...actual.vehiculoService,
      getClienteByVehiculoId: vi.fn(),
      updateCliente: vi.fn(),
    },
  };
});

describe("PUT /api/vehiculos/[id]/cliente", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(vehiculoService.getClienteByVehiculoId).mockResolvedValue({ data: null, error: null });
    vi.mocked(vehiculoService.updateCliente).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
  });

  it("GET: si el vehículo no existe, devuelve 404 con mensaje de vehículo no encontrado", async () => {
    vi.mocked(vehiculoService.getClienteByVehiculoId).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/vehiculos/v1/cliente", { method: "GET" });
    const params = Promise.resolve({ id: "v1" });

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ data: null, error: "Vehículo no encontrado" });
  });

  it("si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/vehiculos/v1/cliente", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: "c2" }),
    });
    const params = Promise.resolve({ id: "v1" });

    const response = await PUT(req, { params });
    expect(response.status).toBe(200);
    expect(vehiculoService.updateCliente).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });
});


