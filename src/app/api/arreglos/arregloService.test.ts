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
    countAll: vi.fn().mockResolvedValue(0),
    countByPago: vi.fn().mockResolvedValue(0),
    sumIngresos: vi.fn().mockResolvedValue(0),
    tiposConIngresos: vi.fn().mockResolvedValue([]),
    listRecentActivities: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("arregloService", () => {
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

  describe("tiposConIngresos", () => {
    it("tipo null o vacío se normaliza a 'Sin tipo'", async () => {
      const repo = makeRepo({
        tiposConIngresos: vi.fn().mockResolvedValue([
          { tipo: null, cantidad: 3, ingresos: 1000 },
          { tipo: "  ", cantidad: 1, ingresos: 500 },
          { tipo: "Service", cantidad: 2, ingresos: 2000 },
        ]),
      });
      const result = await createArregloService(repo).tiposConIngresos(mockSupabase);
      expect(result.tipos).toEqual(["Sin tipo", "Sin tipo", "Service"]);
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
