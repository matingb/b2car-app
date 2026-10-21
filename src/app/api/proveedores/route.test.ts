import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockApiSession } from "@/tests/apiRoute";
import { logger } from "@/lib/logger";
import { proveedorService } from "./proveedorService";
import { ServiceError } from "../serviceError";
import { GET, POST } from "./route";
import { Permission } from "@/lib/permissions";

vi.mock("@/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/permissions.server", () => ({
  fetchEffectivePermissions: vi.fn(),
  fetchPlanPermissions: vi.fn(),
}));
vi.mock("./proveedorService", () => ({
  proveedorService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

const segment = () => ({ params: Promise.resolve({}) });
const row = {
  id: "e4a2a11b-7159-4d64-88aa-38e56d787090",
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

describe("GET /api/proveedores", () => {
  it("requiere permiso proveedores:view", async () => {
    mockApiSession({ permissions: [] });
    const req = new NextRequest("http://localhost/api/proveedores");
    const res = await GET(req, segment());

    expect(res.status).toBe(403);
    expect(proveedorService.list).not.toHaveBeenCalled();
  });

  it("devuelve la lista de proveedores", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.ProveedoresView] });
    vi.mocked(proveedorService.list).mockResolvedValueOnce({ data: [row], error: null });

    const req = new NextRequest("http://localhost/api/proveedores?search=distribuidora");
    const res = await GET(req, segment());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nombre).toBe("Distribuidora Repuestos SA");
    expect(proveedorService.list).toHaveBeenCalledWith(supabase, {
      search: "distribuidora",
      limit: undefined,
    });
  });
});

describe("POST /api/proveedores", () => {
  it("requiere permiso proveedores:edit", async () => {
    mockApiSession({ permissions: [Permission.ProveedoresView] });
    const req = new NextRequest("http://localhost/api/proveedores", {
      method: "POST",
      body: JSON.stringify({ nombre: "Nuevo Proveedor" }),
    });
    const res = await POST(req, segment());

    expect(res.status).toBe(403);
    expect(proveedorService.create).not.toHaveBeenCalled();
  });

  it("valida que el nombre sea obligatorio", async () => {
    const req = new NextRequest("http://localhost/api/proveedores", {
      method: "POST",
      body: JSON.stringify({ nombre: "   " }),
    });
    const res = await POST(req, segment());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("nombre");
  });

  it("crea un proveedor exitosamente con status 201", async () => {
    const { supabase } = mockApiSession({ permissions: [Permission.ProveedoresEdit] });
    vi.mocked(proveedorService.create).mockResolvedValueOnce({ data: row, error: null });

    const req = new NextRequest("http://localhost/api/proveedores", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Distribuidora Repuestos SA",
        cuit: "30712345678",
      }),
    });
    const res = await POST(req, segment());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe(row.id);
    expect(proveedorService.create).toHaveBeenCalledWith(supabase, {
      nombre: "Distribuidora Repuestos SA",
      cuit: "30712345678",
      telefono: null,
      email: null,
      direccion: null,
    });
  });

  it("devuelve 409 cuando hay conflicto de CUIT", async () => {
    vi.mocked(proveedorService.create).mockResolvedValueOnce({
      data: null,
      error: ServiceError.Conflict,
    });

    const req = new NextRequest("http://localhost/api/proveedores", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Distribuidora Repuestos SA",
        cuit: "30712345678",
      }),
    });
    const res = await POST(req, segment());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("CUIT");
  });
});
