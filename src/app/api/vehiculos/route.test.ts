import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { vehiculoService } from "./vehiculoService";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { createCreateVehiculoRequest } from "@/tests/factories";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./vehiculoService", () => ({
  vehiculoService: {
    create: vi.fn(),
  },
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

describe("POST /api/vehiculos", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("dado un vehiculo con cliente y patente se debe poder crear un vehiculo", async () => {
    const inserted = { id: "123" };
    vi.mocked(vehiculoService.create).mockResolvedValue({ data: inserted, error: null });

    const req = new Request("http://localhost/api/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateVehiculoRequest()),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(vehiculoService.create).toHaveBeenCalledWith(mockSupabase, {
      cliente_id: "c1",
      patente: "AA123BB",
      marca: "",
      modelo: "",
      fecha_patente: "",
      nro_interno: "",
    });

    expect(response.status).toBe(201);
    expect(body).toEqual({ data: inserted, error: null });

    expect(vehiculoService.create).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("dado un JSON inválido debe devolver 400", async () => {
    const req = new Request("http://localhost/api/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "JSON inválido" });
  });

  it("dado un vehiculo sin cliente debe devolver 400", async () => {
    const req = new Request("http://localhost/api/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateVehiculoRequest({ cliente_id: "" })),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Falta cliente_id" });
    expect(vehiculoService.create).not.toHaveBeenCalled();
  });

  it("dado un vehiculo sin patente debe devolver 400", async () => {
    const req = new Request("http://localhost/api/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateVehiculoRequest({ patente: "" })),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Falta patente" });
    expect(vehiculoService.create).not.toHaveBeenCalled();
  });
});


