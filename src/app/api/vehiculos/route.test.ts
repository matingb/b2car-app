import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { vehiculoService } from "./vehiculoService";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./vehiculoService", () => ({
  vehiculoService: {
    create: vi.fn(),
  },
}));

describe("POST /api/vehiculos", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("dado un vehiculo con cliente y patente se debe poder crear un vehiculo", async () => {
    const inserted = { id: 123 };
    vi.mocked(vehiculoService.create).mockResolvedValue({ data: inserted, error: null });

    const req = {
      json: vi.fn().mockResolvedValue({ cliente_id: 1, patente: "AA123BB" }),
    } as unknown as Request;

    const response = await POST(req);
    const body = await response.json();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(vehiculoService.create).toHaveBeenCalledWith(mockSupabase, {
      cliente_id: 1,
      patente: "AA123BB",
      marca: "",
      modelo: "",
      fecha_patente: "",
      nro_interno: "",
    });

    expect(response.status).toBe(201);
    expect(body).toEqual({ data: inserted, error: null });
  });

  it("dado un JSON inválido debe devolver 400", async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    } as unknown as Request;

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "JSON inválido" });
  });

  it("dado un vehiculo sin cliente debe devolver 400", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({ patente: "AA123BB" }),
    } as unknown as Request;

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Falta cliente_id" });
  });

  it("dado un vehiculo sin patente debe devolver 400", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({ cliente_id: 1 }),
    } as unknown as Request;

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Falta patente" });
  });
});


