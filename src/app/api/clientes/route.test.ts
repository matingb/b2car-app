import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { clienteService } from "./clienteService";
import { NextRequest } from "next/server";
import { Cliente, TipoCliente } from "@/model/types";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("./clienteService", () => ({
  clienteService: {
    getClientes: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("GET /api/clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a getClientes con parámetros por defecto y devuelve datos con hasMore", async () => {
    const mockRows = [
      {
        id: "c1",
        nombre: "Juan Perez",
        tipo_cliente: TipoCliente.PARTICULAR,
        saldo_cuenta: 0,
        vehiculos_count: 1,
      },
    ];
    vi.mocked(clienteService.getClientes).mockResolvedValue({
      data: { rows: mockRows as unknown as Cliente[], hasMore: false },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/clientes");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(clienteService.getClientes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        limit: 50,
        search: undefined,
        tipo: undefined,
        saldo: undefined,
      })
    );
    expect(body).toEqual({
      data: mockRows,
      page: { hasMore: false },
      error: null,
    });
  });

  it("pasa filtros de búsqueda, tipo y saldo correctamente", async () => {
    vi.mocked(clienteService.getClientes).mockResolvedValue({
      data: { rows: [], hasMore: true },
      error: null,
    });

    const req = new NextRequest(
      "http://localhost:3000/api/clientes?search=test&tipo=empresa&saldo=PENDIENTE&limit=25"
    );
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(clienteService.getClientes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        search: "test",
        tipo: "empresa",
        saldo: "PENDIENTE",
        limit: 25,
      })
    );
    expect(body).toEqual({
      data: [],
      page: { hasMore: true },
      error: null,
    });
  });

  it("devuelve 500 si clienteService retorna error", async () => {
    vi.mocked(clienteService.getClientes).mockResolvedValue({
      data: null,
      error: new Error("DB error"),
    });

    const req = new NextRequest("http://localhost:3000/api/clientes");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      data: [],
      page: { hasMore: false },
      error: "DB error",
    });
  });
});
