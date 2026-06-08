import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./empleadosService", async () => {
  const actual = await vi.importActual<typeof import("./empleadosService")>("./empleadosService");
  return {
    ...actual,
    empleadosService: {
      ...actual.empleadosService,
      list: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

import { createClient } from "@/supabase/server";
import { empleadosService, type EmpleadoRow } from "./empleadosService";
import { SupabaseClient } from "@supabase/supabase-js";
import type { CreateEmpleadoRequest } from "./contracts";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

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

describe("/api/empleados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    } as unknown as SupabaseClient);
  });

  const postEmpleado = async (payload: Partial<CreateEmpleadoRequest>) => {
    const reqPayload: CreateEmpleadoRequest = {
      taller_id: "TAL-1",
      nombre: "Juan",
      apellido: "Pérez",
      dni: "12345678",
      ...payload,
    };

    const req = new Request("http://localhost/api/empleados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqPayload),
    });
    const res = await POST(req);
    const body = await res.json().catch(() => null);

    return { res, body };
  };

  it("GET sin sesión devuelve 401", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: null } }) },
    } as unknown as SupabaseClient);

    const req = new NextRequest("http://localhost/api/empleados");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("GET devuelve lista mapeada", async () => {
    vi.mocked(empleadosService.list).mockResolvedValue({
      data: [createEmpleadoRow({ id: "EMP-1", nombre: "Juan", apellido: "Pérez" })],
      error: null,
    });

    const req = new NextRequest("http://localhost/api/empleados");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe("EMP-1");
    expect(body.data[0].nombre).toBe("Juan");
  });

  it("GET con tallerId filtra por taller", async () => {
    vi.mocked(empleadosService.list).mockResolvedValue({ data: [], error: null });

    const req = new NextRequest("http://localhost/api/empleados?tallerId=TAL-9");
    await GET(req);

    expect(empleadosService.list).toHaveBeenCalledWith(expect.anything(), { tallerId: "TAL-9" });
  });

  it("POST con JSON inválido devuelve 400", async () => {
    const req = new Request("http://localhost/api/empleados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST sin taller_id devuelve 400", async () => {
    const { res } = await postEmpleado({ taller_id: "  " });
    expect(res.status).toBe(400);
  });

  it("POST sin nombre devuelve 400", async () => {
    const { res } = await postEmpleado({ nombre: "  " });
    expect(res.status).toBe(400);
  });

  it("POST sin apellido devuelve 400", async () => {
    const { res } = await postEmpleado({ apellido: "  " });
    expect(res.status).toBe(400);
  });

  it("POST sin dni devuelve 400", async () => {
    const { res } = await postEmpleado({ dni: "  " });
    expect(res.status).toBe(400);
  });

  it("POST con salario negativo devuelve 400", async () => {
    const { res } = await postEmpleado({ salario: -100 });
    expect(res.status).toBe(400);
  });

  it("POST con cumpleanos inválido devuelve 400", async () => {
    const { res } = await postEmpleado({ cumpleanos: "no-es-fecha" });
    expect(res.status).toBe(400);
  });

  it("POST con fecha_ingreso inválida devuelve 400", async () => {
    const { res } = await postEmpleado({ fecha_ingreso: "2026/01/01" });
    expect(res.status).toBe(400);
  });

  it("POST exitoso devuelve 201", async () => {
    vi.mocked(empleadosService.create).mockResolvedValue({
      data: createEmpleadoRow({ id: "EMP-1" }),
      error: null,
    });

    const { res, body } = await postEmpleado({ salario: 1000, cumpleanos: "1990-05-15" });

    expect(res.status).toBe(201);
    expect(body.data?.id).toBe("EMP-1");
    expect(statsService.onDataChanged).toHaveBeenCalledWith(expect.anything(), "TEN-1");
  });
});
