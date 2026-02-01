import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/arreglos/repuestos/repuestosService", () => ({
  repuestosService: {
    getOperacionLineaById: vi.fn(),
    getAsignacionByOperacionAndArreglo: vi.fn(),
    deleteAsignacionArregloLinea: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { repuestosService } from "@/app/api/arreglos/repuestos/repuestosService";

describe("DELETE /api/arreglos/[id]/repuestos/[lineaId]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("si el arreglo no tiene la línea de repuesto, responde no encontrado", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "Repuesto no encontrado en este arreglo.",
    });
  });

  it("si no se puede validar que el arreglo tenga la línea de repuesto, responde error interno", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: null,
      error: { message: "boom" },
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "No se pudo validar el repuesto. Intentá nuevamente.",
    });
  });

  it("si la línea existe pero no pertenece a este arreglo, responde 404 (no encontrado)", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: { id: "L-1", operacion_id: "OP-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.getAsignacionByOperacionAndArreglo).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: "Repuesto no encontrado en este arreglo.",
    });
  });

  it("si la sesión no tiene permisos para eliminar (RLS/permiso), responde 401", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: { id: "L-1", operacion_id: "OP-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.getAsignacionByOperacionAndArreglo).mockResolvedValue({
      data: { operacion_id: "OP-1", arreglo_id: "A-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.deleteAsignacionArregloLinea).mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Tu sesión expiró o no tenés permisos para eliminar este repuesto.",
    });
  });

  it("si el RPC falla por JWT sin tenant_id, responde 401", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: { id: "L-1", operacion_id: "OP-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.getAsignacionByOperacionAndArreglo).mockResolvedValue({
      data: { operacion_id: "OP-1", arreglo_id: "A-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.deleteAsignacionArregloLinea).mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "JWT sin tenant_id" },
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Tu sesión expiró o no tenés permisos para eliminar este repuesto.",
    });
  });

  it("si la línea pertenece al arreglo y el RPC se ejecuta correctamente, responde 200", async () => {
    vi.mocked(repuestosService.getOperacionLineaById).mockResolvedValue({
      data: { id: "L-1", operacion_id: "OP-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.getAsignacionByOperacionAndArreglo).mockResolvedValue({
      data: { operacion_id: "OP-1", arreglo_id: "A-1" },
      error: null,
    } as never);
    vi.mocked(repuestosService.deleteAsignacionArregloLinea).mockResolvedValue({
      data: "OP-1",
      error: null,
    } as never);

    const req = {} as NextRequest;
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "A-1", lineaId: "L-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ error: null });
  });
});

