import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, PUT, DELETE } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../empleadosService", async () => {
  const actual = await vi.importActual<typeof import("../empleadosService")>("../empleadosService");
  return {
    ...actual,
    empleadosService: {
      ...actual.empleadosService,
      getById: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    },
  };
});

import { createClient } from "@/supabase/server";
import { empleadosService, type EmpleadoRow } from "../empleadosService";
import { ServiceError } from "@/app/api/serviceError";

function createEmpleadoRow(overrides: Partial<EmpleadoRow> = {}): EmpleadoRow {
  return {
    id: "EMP-1",
    tenant_id: "TEN-1",
    taller_id: "TAL-1",
    nombre: "Juan",
    apellido: "Pérez",
    dni: "12345678",
    email: null,
    telefono: null,
    cumpleanos: null,
    salario: null,
    fecha_ingreso: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("/api/empleados/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as unknown as SupabaseClient);
  });

  it("GET sin sesión devuelve 401", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: null } }) },
    } as unknown as SupabaseClient);

    const req = new NextRequest("http://localhost/api/empleados/e1");
    const res = await GET(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("GET not found devuelve 404", async () => {
    vi.mocked(empleadosService.getById).mockResolvedValue({ data: null, error: ServiceError.NotFound });
    const req = new NextRequest("http://localhost/api/empleados/e1");
    const res = await GET(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("GET existente devuelve 200 con DTO", async () => {
    vi.mocked(empleadosService.getById).mockResolvedValue({
      data: createEmpleadoRow({ id: "EMP-1", nombre: "Juan" }),
      error: null,
    });
    const req = new NextRequest("http://localhost/api/empleados/EMP-1");
    const res = await GET(req, { params: Promise.resolve({ id: "EMP-1" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.id).toBe("EMP-1");
  });

  it("PUT actualiza y devuelve 200", async () => {
    vi.mocked(empleadosService.updateById).mockResolvedValue({
      data: createEmpleadoRow({ id: "EMP-1", nombre: "Pedro" }),
      error: null,
    });

    const req = new NextRequest("http://localhost/api/empleados/EMP-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Pedro" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "EMP-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data?.nombre).toBe("Pedro");
  });

  it("PUT rechaza nombre vacío con 400", async () => {
    const req = new NextRequest("http://localhost/api/empleados/EMP-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "   " }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "EMP-1" }) });
    expect(res.status).toBe(400);
  });

  it("PUT rechaza salario negativo con 400", async () => {
    const req = new NextRequest("http://localhost/api/empleados/EMP-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salario: -50 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "EMP-1" }) });
    expect(res.status).toBe(400);
  });

  it("PUT rechaza fecha de cumpleaños inválida con 400", async () => {
    const req = new NextRequest("http://localhost/api/empleados/EMP-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cumpleanos: "abc" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "EMP-1" }) });
    expect(res.status).toBe(400);
  });

  it("PUT not found devuelve 404", async () => {
    vi.mocked(empleadosService.updateById).mockResolvedValue({
      data: null,
      error: ServiceError.NotFound,
    });

    const req = new NextRequest("http://localhost/api/empleados/EMP-NOPE", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "X" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "EMP-NOPE" }) });
    expect(res.status).toBe(404);
  });

  it("DELETE elimina y devuelve 200", async () => {
    vi.mocked(empleadosService.deleteById).mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/api/empleados/EMP-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "EMP-1" }) });
    expect(res.status).toBe(200);
  });
});
