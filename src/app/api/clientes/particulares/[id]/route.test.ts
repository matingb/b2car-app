import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { DELETE, PUT } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { particularService } from "../particularService";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../particularService", () => ({
  particularService: {
    getByIdWithVehiculos: vi.fn(),
    updateById: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("PUT /api/clientes/particulares/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;
  const context = { params: Promise.resolve({ id: "particular-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(particularService.updateById).mockResolvedValue({ data: { id: "particular-1" }, error: null });
  });

  it("normaliza el DNI/CUIL antes de actualizar", async () => {
    const request = new Request("http://localhost/api/clientes/particulares/particular-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Juan",
        telefono: "",
        email: "",
        direccion: "",
        dni_cuil: "20-12345678-6",
      }),
    }) as NextRequest;

    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(particularService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "particular-1",
      expect.objectContaining({ dni_cuil: "20123456786" }),
    );
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("rechaza un DNI/CUIL inválido sin actualizar", async () => {
    const request = new Request("http://localhost/api/clientes/particulares/particular-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Juan", telefono: "", email: "", direccion: "", dni_cuil: "123" }),
    }) as NextRequest;

    const response = await PUT(request, context);

    expect(response.status).toBe(400);
    expect(particularService.updateById).not.toHaveBeenCalled();
  });

  it("informa el conflicto de DNI/CUIL duplicado", async () => {
    vi.mocked(particularService.updateById).mockResolvedValue({
      data: null,
      error: Object.assign(new Error("duplicate key"), { code: "23505" }),
    });
    const request = new Request("http://localhost/api/clientes/particulares/particular-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Juan", telefono: "", email: "", direccion: "", dni_cuil: "20123456786" }),
    }) as NextRequest;

    const response = await PUT(request, context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Ya existe un particular con ese DNI/CUIL" });
  });
});

describe("DELETE /api/clientes/particulares/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  it("devuelve 200 y actualiza los stats cuando elimina un particular", async () => {
    vi.mocked(particularService.delete).mockResolvedValue({ error: null });

    const response = await DELETE({} as NextRequest, {
      params: Promise.resolve({ id: "123" }),
    });

    expect(particularService.delete).toHaveBeenCalledWith(mockSupabase, "123");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("devuelve el error cuando no puede eliminar un particular", async () => {
    vi.mocked(particularService.delete).mockResolvedValue({
      error: new Error("Error en la transacción de eliminación"),
    });

    const response = await DELETE({} as NextRequest, {
      params: Promise.resolve({ id: "123" }),
    });

    expect(particularService.delete).toHaveBeenCalledWith(mockSupabase, "123");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Error en la transacción de eliminación" });
  });
});
