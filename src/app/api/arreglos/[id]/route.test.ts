import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "../arregloService";
import { NextRequest } from "next/server";
import { Arreglo } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../arregloService", () => ({
  arregloService: {
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

describe("Mutaciones /api/arreglos/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.updateById).mockResolvedValue({ data: { id: "a1" } as Arreglo, error: null });
    vi.mocked(arregloService.deleteById).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
  });

  it("si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: "Nueva desc" }),
    });

    const params = Promise.resolve({ id: "a1" });
    await PUT(req, { params });

    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("PUT: si el estado es inválido devuelve 400 y no llama al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "pausado" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ data: null, error: "Estado de arreglo inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: normaliza estado (trim + uppercase) antes de llamar al service", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: " en_progreso " }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(arregloService.updateById).toHaveBeenCalledWith(
      mockSupabase,
      "a1",
      expect.objectContaining({ estado: "EN_PROGRESO" })
    );
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("PUT: si el service devuelve NotFound, responde 404", async () => {
    vi.mocked(arregloService.updateById).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "TERMINADO" }),
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ data: null, error: "Arreglo no encontrado" });
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("PUT: si el JSON es inválido, responde 400", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    const response = await PUT(req, { params: Promise.resolve({ id: "a1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "JSON inválido" });
    expect(arregloService.updateById).not.toHaveBeenCalled();
    expect(statsService.onDataChanged).not.toHaveBeenCalled();
  });

  it("si delete es exitoso, registra cambios en los stats", async () => {
    const req = {} as NextRequest;
    const params = Promise.resolve({ id: "a1" });
    await DELETE(req, { params });
    
    expect(arregloService.deleteById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });
});


