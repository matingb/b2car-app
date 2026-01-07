import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, DELETE } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "../arregloService";
import { NextRequest } from "next/server";
import { Arreglo } from "@/model/types";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("../arregloService", () => ({
  arregloService: {
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
}));

describe("Mutaciones /api/arreglos/[id]", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.updateById).mockResolvedValue({ data: { id: "a1" } as Arreglo, error: null });
    vi.mocked(arregloService.deleteById).mockResolvedValue(
      { error: null } as unknown as { error: null }
    );
  });

  it("si update es exitoso, registra cambios en los stats", async () => {
    const req = new NextRequest("http://localhost/api/arreglos/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: "Nueva desc" }),
    });

    const params = Promise.resolve({ id: "a1" });
    await PUT(req, { params });

    expect(arregloService.updateById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("si delete es exitoso, registra cambios en los stats", async () => {
    const req = {} as NextRequest;
    const params = Promise.resolve({ id: "a1" });
    await DELETE(req, { params });
    
    expect(arregloService.deleteById).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });
});


