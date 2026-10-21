import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { proveedorService } from "../proveedorService";
import { ServiceError } from "../../serviceError";
import { GET, PUT, DELETE } from "./route";
import { Permission } from "@/lib/permissions";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: vi.fn(),
  fetchPlanPermissions: vi.fn(),
}));
vi.mock("../proveedorService", () => ({
  proveedorService: {
    getById: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

const validId = "e4a2a11b-7159-4d64-88aa-38e56d787090";
const segment = (id: string = validId) => ({ params: Promise.resolve({ id }) });
const row = {
  id: validId,
  tenant_id: "tenant-1",
  nombre: "Distribuidora Repuestos SA",
  cuit: "30712345678",
  telefono: "1122334455",
  email: "ventas@distribuidora.com",
  direccion: "Av. Warnes 1234",
  created_at: "2026-10-21T12:00:00Z",
  updated_at: "2026-10-21T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApiSession({ permissions: [Permission.ProveedoresView, Permission.ProveedoresEdit] });
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("GET /api/proveedores/[id]", () => {
  it("valida que el id sea un UUID válido", async () => {
    const req = new NextRequest("http://localhost/api/proveedores/invalid-id");
    const res = await GET(req, segment("invalid-id"));

    expect(res.status).toBe(400);
    expect(proveedorService.getById).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el proveedor no existe", async () => {
    vi.mocked(proveedorService.getById).mockResolvedValueOnce({
      data: null,
      error: ServiceError.NotFound,
    });
    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`);
    const res = await GET(req, segment());

    expect(res.status).toBe(404);
  });

  it("devuelve los datos del proveedor", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.ProveedoresView] });
    vi.mocked(proveedorService.getById).mockResolvedValueOnce({ data: row, error: null });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`);
    const res = await GET(req, segment());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(validId);
    expect(body.data.nombre).toBe("Distribuidora Repuestos SA");
    expect(proveedorService.getById).toHaveBeenCalledWith(supabase, validId);
  });
});

describe("PUT /api/proveedores/[id]", () => {
  it("actualiza los datos del proveedor", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.ProveedoresEdit] });
    const updatedRow = { ...row, nombre: "Distribuidora Actualizada" };
    vi.mocked(proveedorService.updateById).mockResolvedValueOnce({ data: updatedRow, error: null });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`, {
      method: "PUT",
      body: JSON.stringify({ nombre: "Distribuidora Actualizada" }),
    });
    const res = await PUT(req, segment());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.nombre).toBe("Distribuidora Actualizada");
    expect(proveedorService.updateById).toHaveBeenCalledWith(supabase, validId, {
      nombre: "Distribuidora Actualizada",
    });
  });

  it("devuelve 409 si el CUIT actualizado entra en conflicto", async () => {
    vi.mocked(proveedorService.updateById).mockResolvedValueOnce({
      data: null,
      error: ServiceError.Conflict,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`, {
      method: "PUT",
      body: JSON.stringify({ cuit: "30999999999" }),
    });
    const res = await PUT(req, segment());

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/proveedores/[id]", () => {
  it("elimina el proveedor correctamente", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.ProveedoresEdit] });
    vi.mocked(proveedorService.deleteById).mockResolvedValueOnce({ error: null });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, segment());

    expect(res.status).toBe(200);
    expect(proveedorService.deleteById).toHaveBeenCalledWith(supabase, validId);
  });

  it("devuelve 404 si el proveedor a eliminar no existe", async () => {
    vi.mocked(proveedorService.deleteById).mockResolvedValueOnce({
      error: ServiceError.NotFound,
    });

    const req = new NextRequest(`http://localhost/api/proveedores/${validId}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, segment());

    expect(res.status).toBe(404);
  });
});
