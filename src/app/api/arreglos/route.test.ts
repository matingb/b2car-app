import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createClient } from "@/supabase/server";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "./arregloService";
import { Arreglo } from "@/model/types";
import { createCreateArregloRequest } from "@/tests/factories";

vi.mock("@/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/api/dashboard/stats/dashboardStatsService", () => ({
  statsService: {
    onDataChanged: vi.fn(),
  },
}));

vi.mock("./arregloService", () => ({
  arregloService: {
    create: vi.fn(),
  },
}));

describe("POST /api/arreglos", () => {
  const mockSupabase = {} as Awaited<ReturnType<typeof createClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(arregloService.create).mockResolvedValue({
      data: { id: "a1" } as Arreglo,
      error: null,
    });
  });

  it("si el insert es exitoso, registra cambios en los stats", async () => {
    const req = new Request("http://localhost/api/arreglos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createCreateArregloRequest()),
    });

    await POST(req);
    
    expect(arregloService.create).toHaveBeenCalledTimes(1);
    expect(statsService.onDataChanged).toHaveBeenCalledTimes(1);
  });
});


