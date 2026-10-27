import { describe, it, expect, vi } from "vitest";
import { createArregloService } from "./arregloService";
import type { ArregloRepository } from "./arregloRepository";
import { ServiceError } from "@/app/api/serviceError";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockSupabase = {} as SupabaseClient;

function makeRepo(overrides: Partial<ArregloRepository> = {}): ArregloRepository {
  return {
    getArreglo: vi.fn().mockResolvedValue({ data: { rows: [], hasMore: false }, error: null }),
    getByIdWithVehiculo: vi.fn().mockResolvedValue({ data: null, error: null }),
    create: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: null, error: null }),
    listOperacionIdsByArregloId: vi.fn().mockResolvedValue({ data: [], error: null }),
    deleteOperacionesConStockLista: vi.fn().mockResolvedValue({ error: null }),
    deleteById: vi.fn().mockResolvedValue({ error: null }),
    dashboardPeriodo: vi.fn().mockResolvedValue({
      resumen: {
        total: 0,
        cobrados: 0,
        parciales: 0,
        pendientes: 0,
        montoIngresos: 0,
        montoCobradoTotal: 0,
        montoCobradoParcial: 0,
        montoPendienteParcial: 0,
        montoPendiente: 0,
      },
      series: { arreglos: [], ingresos: [], gastos: [] },
    }),
    horasTrabajadasPorEmpleado: vi.fn().mockResolvedValue({ totalHoras: 0, empleados: [] }),
    facturacionPorTipo: vi.fn().mockResolvedValue([]),
    facturacionPorEmpleado: vi.fn().mockResolvedValue([]),
    costoPorTipo: vi.fn().mockResolvedValue([]),
    costoPorEmpleado: vi.fn().mockResolvedValue([]),
    listRecentActivities: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("arregloService", () => {
  describe("dashboardPeriodo", () => {
    it("preserva el resumen de cobros parciales y las series diarias del repositorio", async () => {
      const periodo = {
        resumen: {
          total: 5,
          cobrados: 2,
          parciales: 1,
          pendientes: 2,
          montoIngresos: 25000,
          montoCobradoTotal: 12000,
          montoCobradoParcial: 3000,
          montoPendienteParcial: 2000,
          montoPendiente: 8000,
        },
        series: {
          arreglos: [{ fecha: "2026-08-01", cantidad: 5 }],
          ingresos: [{ fecha: "2026-08-01", mano_de_obra: 15000, repuestos: 10000, ventas: 0 }],
          gastos: [{ fecha: "2026-08-01", repuestos: 0, sueldos: 9000, eventuales: 0 }],
        },
      };
      const dashboardPeriodo = vi.fn().mockResolvedValue(periodo);
      const repo = makeRepo({ dashboardPeriodo });

      const result = await createArregloService(repo).dashboardPeriodo(
        mockSupabase,
        "2026-08-01T03:00:00.000Z",
        "2026-09-01T03:00:00.000Z"
      );

      expect(dashboardPeriodo).toHaveBeenCalledWith(
        mockSupabase,
        "2026-08-01T03:00:00.000Z",
        "2026-09-01T03:00:00.000Z",
        undefined
      );
      expect(result).toEqual(periodo);
    });
  });

  describe("horasTrabajadasPorEmpleado", () => {
    it("delega rango y taller en el repositorio", async () => {
      const desglose = {
        totalHoras: 2.5,
        empleados: [{ empleadoId: "emp-1", label: "Ana", horasTrabajadas: 2.5 }],
      };
      const horasTrabajadasPorEmpleado = vi.fn().mockResolvedValue(desglose);
      const repo = makeRepo({ horasTrabajadasPorEmpleado });

      const result = await createArregloService(repo).horasTrabajadasPorEmpleado(
        mockSupabase,
        "2026-08-01T03:00:00.000Z",
        "2026-09-01T03:00:00.000Z",
        "taller-1"
      );

      expect(horasTrabajadasPorEmpleado).toHaveBeenCalledWith(
        mockSupabase,
        "2026-08-01T03:00:00.000Z",
        "2026-09-01T03:00:00.000Z",
        "taller-1"
      );
      expect(result).toEqual(desglose);
    });
  });

  describe("getArreglo", () => {
    it("propaga el error del repositorio", async () => {
      const repo = makeRepo({
        getArreglo: vi.fn().mockResolvedValue({ data: null, error: ServiceError.Unknown }),
      });
      const result = await createArregloService(repo).getArreglo(mockSupabase, { limit: 10 });
      expect(result).toEqual({ data: null, error: ServiceError.Unknown });
    });

    it("devuelve las filas del repositorio sin recalcular descripcion", async () => {
      const repo = makeRepo({
        getArreglo: vi.fn().mockResolvedValue({
          data: {
            rows: [{ id: "a1", descripcion: "Service | Frenos", tipo: "Service" }],
            hasMore: false,
          },
          error: null,
        }),
      });
      const result = await createArregloService(repo).getArreglo(mockSupabase, { limit: 10 });
      expect(result.data?.items[0]).toMatchObject({ descripcion: "Service | Frenos" });
    });

    it("preserva la descripcion persistida tal como viene", async () => {
      const repo = makeRepo({
        getArreglo: vi.fn().mockResolvedValue({
          data: {
            rows: [{ id: "a1", descripcion: "Solo texto", tipo: "" }],
            hasMore: false,
          },
          error: null,
        }),
      });
      const result = await createArregloService(repo).getArreglo(mockSupabase, { limit: 10 });
      expect(result.data?.items[0]).toMatchObject({ descripcion: "Solo texto" });
    });
  });

  describe("deleteById", () => {
    it("si deleteById falla en el repositorio, retorna ese error", async () => {
      const repo = makeRepo({
        deleteById: vi.fn().mockResolvedValue({ error: ServiceError.Unknown }),
      });

      const result = await createArregloService(repo).deleteById(mockSupabase, "a1");

      expect(result.error).toBe(ServiceError.Unknown);
    });

    it("si deleteById del repositorio no falla, retorna error null", async () => {
      const repo = makeRepo({
        deleteById: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await createArregloService(repo).deleteById(mockSupabase, "a1");

      expect(result.error).toBeNull();
    });
  });

  describe("desgloses de facturacion y costo", () => {
    const desglose = [{ label: "Mecanica", cantidad: 2, monto: 2000 }];

    it("facturacionPorTipo delega en el repositorio", async () => {
      const repo = makeRepo({ facturacionPorTipo: vi.fn().mockResolvedValue(desglose) });
      const result = await createArregloService(repo).facturacionPorTipo(mockSupabase, "2026-01-01", "2026-02-01");
      expect(result).toEqual(desglose);
    });

    it("facturacionPorEmpleado delega en el repositorio", async () => {
      const repo = makeRepo({ facturacionPorEmpleado: vi.fn().mockResolvedValue(desglose) });
      const result = await createArregloService(repo).facturacionPorEmpleado(mockSupabase, "2026-01-01", "2026-02-01");
      expect(result).toEqual(desglose);
    });

    it("costoPorTipo delega en el repositorio", async () => {
      const repo = makeRepo({ costoPorTipo: vi.fn().mockResolvedValue(desglose) });
      const result = await createArregloService(repo).costoPorTipo(mockSupabase, "2026-01-01", "2026-02-01");
      expect(result).toEqual(desglose);
    });

    it("costoPorEmpleado delega en el repositorio", async () => {
      const repo = makeRepo({ costoPorEmpleado: vi.fn().mockResolvedValue(desglose) });
      const result = await createArregloService(repo).costoPorEmpleado(mockSupabase, "2026-01-01", "2026-02-01");
      expect(result).toEqual(desglose);
    });
  });

  describe("listRecentActivities", () => {
    it("filtra actividades cuyo id es null o vacío", async () => {
      const repo = makeRepo({
        listRecentActivities: vi.fn().mockResolvedValue([
          { id: "a1", descripcion: "Arreglo 1", updated_at: "2026-01-01", precio_final: 1000, vehiculo: { patente: "ABC123" } },
          { id: null, descripcion: "Sin ID", updated_at: "2026-01-01", precio_final: 0, vehiculo: null },
        ]),
      });
      const result = await createArregloService(repo).listRecentActivities(mockSupabase, 10);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("a1");
    });

    it("usa 'Actividad' como titulo cuando descripcion es vacía", async () => {
      const repo = makeRepo({
        listRecentActivities: vi.fn().mockResolvedValue([
          { id: "a1", descripcion: "", updated_at: "2026-01-01", precio_final: 0, vehiculo: null },
        ]),
      });
      const result = await createArregloService(repo).listRecentActivities(mockSupabase, 10);
      expect(result[0].titulo).toBe("Actividad");
    });

    it("usa '-' como vehiculo cuando no hay patente", async () => {
      const repo = makeRepo({
        listRecentActivities: vi.fn().mockResolvedValue([
          { id: "a1", descripcion: "Service", updated_at: "2026-01-01", precio_final: 0, vehiculo: null },
        ]),
      });
      const result = await createArregloService(repo).listRecentActivities(mockSupabase, 10);
      expect(result[0].vehiculo).toBe("-");
    });
  });
});
