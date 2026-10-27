import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  unstableCache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  dashboardPeriodo: vi.fn(),
  listRecentActivities: vi.fn(),
  nuevosPorDia: vi.fn(),
  facturacionPorTipo: vi.fn(),
  facturacionPorEmpleado: vi.fn(),
  horasTrabajadasPorEmpleado: vi.fn(),
  costoPorTipo: vi.fn(),
  costoPorEmpleado: vi.fn(),
  clientesCount: vi.fn(),
  vehiculosCount: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: mocks.unstableCache,
  revalidateTag: vi.fn(),
}));

vi.mock("@/app/api/arreglos/arregloService", () => ({
  arregloService: {
    dashboardPeriodo: mocks.dashboardPeriodo,
    listRecentActivities: mocks.listRecentActivities,
    facturacionPorTipo: mocks.facturacionPorTipo,
    facturacionPorEmpleado: mocks.facturacionPorEmpleado,
    horasTrabajadasPorEmpleado: mocks.horasTrabajadasPorEmpleado,
    costoPorTipo: mocks.costoPorTipo,
    costoPorEmpleado: mocks.costoPorEmpleado,
  },
}));

vi.mock("@/app/api/clientes/clienteService", () => ({
  clienteService: {
    countAll: mocks.clientesCount,
    nuevosPorDia: mocks.nuevosPorDia,
  },
}));

vi.mock("@/app/api/vehiculos/vehiculoService", () => ({
  vehiculoService: { countAll: mocks.vehiculosCount },
}));

import { statsService } from "./dashboardStatsService";

const supabase = {} as SupabaseClient;
const from = "2026-08-01T03:00:00.000Z";
const to = "2026-09-01T03:00:00.000Z";
const periodo = {
  resumen: {
    total: 1,
    cobrados: 0,
    pendientes: 1,
    parciales: 0,
    montoIngresos: 100,
    montoCobradoTotal: 0,
    montoCobradoParcial: 0,
    montoPendienteParcial: 0,
    montoPendiente: 100,
  },
  series: { arreglos: [], ingresos: [], gastos: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unstableCache.mockImplementation((fn) => fn);
  mocks.dashboardPeriodo.mockResolvedValue(periodo);
  mocks.listRecentActivities.mockResolvedValue([]);
  mocks.nuevosPorDia.mockResolvedValue({ dias: [], valor: [] });
  mocks.facturacionPorTipo.mockResolvedValue([]);
  mocks.facturacionPorEmpleado.mockResolvedValue([]);
  mocks.horasTrabajadasPorEmpleado.mockResolvedValue({
    totalHoras: 2.5,
    empleados: [{ empleadoId: "empleado-1", label: "Ana", horasTrabajadas: 2.5 }],
  });
  mocks.costoPorTipo.mockResolvedValue([]);
  mocks.costoPorEmpleado.mockResolvedValue([]);
  mocks.clientesCount.mockResolvedValue(0);
  mocks.vehiculosCount.mockResolvedValue(0);
});

describe("statsService.getStats", () => {
  it("incluye horas trabajadas con el mismo rango global y versiona la caché", async () => {
    const result = await statsService.getStats(supabase, from, to, "tenant-1");

    expect(mocks.horasTrabajadasPorEmpleado).toHaveBeenCalledWith(supabase, from, to);
    expect(mocks.dashboardPeriodo).toHaveBeenCalledWith(supabase, from, to);
    expect(result.horasTrabajadasPorEmpleado).toEqual({
      totalHoras: 2.5,
      empleados: [{ empleadoId: "empleado-1", label: "Ana", horasTrabajadas: 2.5 }],
    });
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["dashboard-stats", "v3", from, to, "tenant-1"],
      { revalidate: 3600, tags: ["dashboard-stats:tenant:tenant-1"] }
    );
  });

  it("propaga una falla de la RPC en vez de devolver cero horas", async () => {
    mocks.horasTrabajadasPorEmpleado.mockRejectedValue(new Error("RPC failed"));

    await expect(statsService.getStats(supabase, from, to, "tenant-1")).rejects.toThrow("RPC failed");
  });
});
