import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { empresaService } from "./empresaService";
import { TipoCliente } from "@/model/types";
import { createCreateEmpresaRequest } from "@/tests/factories";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  decodeJwtPayload: () => ({ tenant_id: "t1" }),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("./empresaService", () => ({
  empresaService: {
    fetchByCuitAndTenantId: vi.fn(),
    createClienteEmpresa: vi.fn(),
  },
}));

describe("POST /api/clientes/empresas", () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn() as unknown as () => Promise<{ data: { session: { access_token: string } } }>,
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    (mockSupabase.auth.getSession as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: { session: { access_token: "x.y.z" } },
    });
    vi.mocked(empresaService.fetchByCuitAndTenantId).mockResolvedValue({ data: null, error: null });
    vi.mocked(empresaService.createClienteEmpresa).mockResolvedValue({
      data: {
        id: "c1",
        nombre: "ACME",
        cuit: "20-123",
        tipo_cliente: TipoCliente.EMPRESA,
        telefono: "",
        email: "",
        direccion: "",
      },
      error: null,
    });
  });

  it("si la creación es exitosa, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/clientes/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateEmpresaRequest()),
    });

    await POST(req);
    
    expect(empresaService.createClienteEmpresa).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });
});


