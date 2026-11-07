import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "./route";
import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { tenantService } from "../../tallerService";
import type { NextRequest } from "next/server";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../tallerService", () => {
  const service = {
    getTalleres: vi.fn(),
    updateTaller: vi.fn(),
  };
  return {
    tallerService: service,
    tenantService: service,
  };
});

describe("PUT /api/tenant/taller/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(null);
  });

  it("retorna 403 o respuesta de error si no tiene permisos", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 })
    );

    const req = {
      json: vi.fn().mockResolvedValue({ valor_hora: 15000 }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(Permission.TallerView);
  });

  it("retorna 400 si falta el id del taller", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({ valor_hora: 15000 }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Falta id");
  });

  it("retorna 400 si el JSON es inválido", async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("JSON inválido");
  });

  it("retorna 400 si el nombre es un string vacío", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({ nombre: "   " }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("El nombre es obligatorio");
  });

  it("retorna 400 si valor_hora es negativo", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({ valor_hora: -500 }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("mayor o igual a 0");
  });

  it("actualiza y retorna 200 con el taller actualizado", async () => {
    const updatedTaller = {
      id: "tal-1",
      nombre: "Taller Central",
      ubicacion: "Av. Libertador 500",
      valor_hora: 16000,
    };

    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(tenantService.updateTaller).mockResolvedValue({
      data: updatedTaller,
      error: null,
    });

    const req = {
      json: vi.fn().mockResolvedValue({
        nombre: "Taller Central",
        ubicacion: "Av. Libertador 500",
        valor_hora: "16000",
      }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(updatedTaller);
    expect(body.error).toBeNull();
    expect(tenantService.updateTaller).toHaveBeenCalledWith(
      expect.anything(),
      "tal-1",
      {
        nombre: "Taller Central",
        ubicacion: "Av. Libertador 500",
        valor_hora: 16000,
      }
    );
  });

  it("normaliza las redes sociales: vacío borra la red y la @ de Instagram no se guarda", async () => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(tenantService.updateTaller).mockResolvedValue({ data: null, error: null });

    const req = {
      json: vi.fn().mockResolvedValue({ whatsapp: "  +54 9 11  5555-5555 ", instagram: "@tallerb2car", facebook: "" }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(200);
    expect(tenantService.updateTaller).toHaveBeenCalledWith(expect.anything(), "tal-1", {
      whatsapp: "+54 9 11 5555-5555",
      instagram: "tallerb2car",
      facebook: null,
    });
  });

  it.each([
    [{ whatsapp: "llamame" }, /WhatsApp/],
    [{ whatsapp: "123" }, /WhatsApp/],
    [{ instagram: "taller b2car" }, /Instagram/],
    [{ facebook: "x".repeat(81) }, /Facebook/],
    [{ instagram: 42 }, /Instagram/],
  ])("retorna 400 si una red social es inválida (%o)", async (body, message) => {
    const req = { json: vi.fn().mockResolvedValue(body) } as unknown as NextRequest;
    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
    expect(tenantService.updateTaller).not.toHaveBeenCalled();
  });

  it("retorna 500 si tenantService falla", async () => {
    vi.mocked(createClient).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(tenantService.updateTaller).mockResolvedValue({
      data: null,
      error: "Error en base de datos",
    });

    const req = {
      json: vi.fn().mockResolvedValue({ valor_hora: 16000 }),
    } as unknown as NextRequest;

    const res = await PUT(req, { params: Promise.resolve({ id: "tal-1" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Error en base de datos");
  });
});
