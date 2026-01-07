import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { representantesService } from "@/app/api/clientes/empresas/representantesService";
import { NextRequest } from "next/server";
import { createCreateRepresentanteBodyRequest } from "@/tests/factories";
import { Representante } from "@/model/types";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("@/app/api/clientes/empresas/representantesService", () => ({
  representantesService: {
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Mutaciones /api/clientes/empresas/[id]/representantes", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(representantesService.create).mockResolvedValue(
      { data: { id: "r1" } as Representante, error: null } as { data: Representante | null; error: null }
    );
    vi.mocked(representantesService.delete).mockResolvedValue(
      { error: null } as { error: null }
    );
  });

  it("POST: si creación es exitosa, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/clientes/empresas/e1/representantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateRepresentanteBodyRequest()),
    });
    const params = Promise.resolve({ id: "e1" });

    const response = await POST(req, { params });
    expect(response.status).toBe(201);
    expect(representantesService.create).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });

  it("DELETE: si borrado es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest(
      "http://localhost/api/clientes/empresas/e1/representantes?representanteId=r1",
      { method: "DELETE" }
    );
    const params = Promise.resolve({ id: "e1" });

    const response = await DELETE(req, { params });
    expect(response.status).toBe(200);
    expect(representantesService.delete).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledWith(mockSupabase);
  });
});


