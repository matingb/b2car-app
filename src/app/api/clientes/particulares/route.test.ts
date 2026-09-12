import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { particularService } from "./particularService";
import { createCreateParticularRequest } from "@/tests/factories";
import { Cliente, TipoCliente } from "@/model/types";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("./particularService", () => ({
  particularService: {
    createClienteParticular: vi.fn(),
  },
}));

describe("POST /api/clientes/particulares", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(particularService.createClienteParticular).mockResolvedValue({
      data: { id: "c1", nombre: "Juan", apellido: "Perez", tipo_cliente: TipoCliente.PARTICULAR, telefono: "1234567890", email: "juan@example.com", direccion: "Calle Falsa 123" },
      error: null,
    } as { data: Cliente | null; error: null });
  });

  it("si la creación es exitosa, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/clientes/particulares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateParticularRequest()),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    expect(particularService.createClienteParticular).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("rechaza un DNI/CUIL con formato inválido antes de crear el cliente", async () => {
    const response = await POST(new Request("http://localhost/api/clientes/particulares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateParticularRequest({ dni_cuil: "123" })),
    }));

    expect(response.status).toBe(400);
    expect(particularService.createClienteParticular).not.toHaveBeenCalled();
  });

  it("expone un conflicto entendible cuando el DNI/CUIL ya existe", async () => {
    vi.mocked(particularService.createClienteParticular).mockResolvedValue({
      data: null,
      error: Object.assign(new Error("duplicate key"), { code: "23505" }),
    } as Awaited<ReturnType<typeof particularService.createClienteParticular>>);

    const response = await POST(new Request("http://localhost/api/clientes/particulares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateParticularRequest({ dni_cuil: "20-12345678-6" })),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Ya existe un particular con ese DNI/CUIL" });
  });
});


