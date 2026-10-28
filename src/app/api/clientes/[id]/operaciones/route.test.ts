import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { clienteOperacionesService } from "../../clienteOperacionesService";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/requirePermission";
import { ServiceError } from "@/app/api/serviceError";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/requirePermission", () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../clienteOperacionesService", () => ({
  clienteOperacionesService: {
    getOperaciones: vi.fn(),
  },
}));

describe("GET /api/clientes/[id]/operaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 403 si falla la verificación de permisos", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce(
      Response.json({ data: null, error: "No autorizado" }, { status: 403 })
    );

    const req = new NextRequest("http://localhost:3000/api/clientes/cli-1/operaciones");
    const res = await GET(req, { params: Promise.resolve({ id: "cli-1" }) });

    expect(res.status).toBe(403);
  });

  it("retorna 200 y los datos de operaciones cuando el servicio responde exitosamente", async () => {
    const mockResumen = {
      totalVendido: 10000,
      totalCobrado: 7000,
      saldoPendiente: 3000,
      operaciones: [],
    };
    vi.mocked(clienteOperacionesService.getOperaciones).mockResolvedValueOnce({
      data: mockResumen,
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/clientes/cli-1/operaciones");
    const res = await GET(req, { params: Promise.resolve({ id: "cli-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: mockResumen, error: null });
  });

  it("retorna 400 cuando el servicio devuelve ServiceError.Validation", async () => {
    vi.mocked(clienteOperacionesService.getOperaciones).mockResolvedValueOnce({
      data: null,
      error: ServiceError.Validation,
    });

    const req = new NextRequest("http://localhost:3000/api/clientes/cli-1/operaciones");
    const res = await GET(req, { params: Promise.resolve({ id: "cli-1" }) });

    expect(res.status).toBe(400);
  });
});
