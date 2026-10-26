import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProductosService, productosService } from "./productosService";
import type { ProductoRepository } from "./productoRepository";
import { ServiceError } from "@/app/api/serviceError";

describe("productosService.deleteById (supabase adapter)", () => {
  it("elimina stocks por producto_id antes de borrar el producto", async () => {
    const calls: { table: string; column: string; value: string }[] = [];
    const supabase = {
      from: (table: string) => ({
        delete: () => ({
          eq: async (column: string, value: string) => {
            calls.push({ table, column, value });
            return { error: null };
          },
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await productosService.deleteById(supabase, "PROD-1");

    expect(result.error).toBeNull();
    expect(calls).toEqual([
      { table: "stocks", column: "producto_id", value: "PROD-1" },
      { table: "productos", column: "id", value: "PROD-1" },
    ]);
  });
});

describe("productosService with mock repository (hexagonal decoupling)", () => {
  const dummySupabase = {} as SupabaseClient;

  it("getWithStocksById retorna NotFound si el producto no existe", async () => {
    const mockRepo: ProductoRepository = {
      list: vi.fn(),
      getById: vi.fn().mockResolvedValue({ data: null, error: null }),
      getStocksByProductoId: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    };
    const service = createProductosService(mockRepo);
    const res = await service.getWithStocksById(dummySupabase, "prod-404");

    expect(res.error).toBe(ServiceError.NotFound);
    expect(res.data).toBeNull();
    expect(mockRepo.getStocksByProductoId).not.toHaveBeenCalled();
  });

  it("getWithStocksById retorna el producto con su lista de stocks", async () => {
    const mockRepo: ProductoRepository = {
      list: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        data: {
          id: "prod-1",
          tenantId: "t1",
          codigo: "COD-1",
          nombre: "Filtro",
          marca: "Bosch",
          modelo: null,
          descripcion: null,
          precio_unitario: 100,
          costo_unitario: 50,
          proveedor: null,
          categorias: ["Filtros"],
          show_in_stock: true,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
        error: null,
      }),
      getStocksByProductoId: vi.fn().mockResolvedValue({
        data: [
          {
            id: "s-1",
            tenant_id: "t1",
            taller_id: "taller-1",
            producto_id: "prod-1",
            cantidad: 5,
            stock_minimo: 2,
            stock_maximo: 20,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          },
        ],
        error: null,
      }),
      create: vi.fn(),
      updateById: vi.fn(),
      deleteById: vi.fn(),
    };
    const service = createProductosService(mockRepo);
    const res = await service.getWithStocksById(dummySupabase, "prod-1");

    expect(res.error).toBeNull();
    expect(res.data?.id).toBe("prod-1");
    expect(res.data?.stocks).toHaveLength(1);
    expect(res.data?.talleresConStock).toBe(1);
  });

  it("updateWithStocksById actualiza y recupera los stocks", async () => {
    const mockRepo: ProductoRepository = {
      list: vi.fn(),
      getById: vi.fn(),
      getStocksByProductoId: vi.fn().mockResolvedValue({ data: [], error: null }),
      create: vi.fn(),
      updateById: vi.fn().mockResolvedValue({
        data: {
          id: "prod-1",
          nombre: "Nuevo Nombre",
        },
        error: null,
      }),
      deleteById: vi.fn(),
    };
    const service = createProductosService(mockRepo);
    const res = await service.updateWithStocksById(dummySupabase, "prod-1", { nombre: "Nuevo Nombre" });

    expect(res.error).toBeNull();
    expect(res.data?.nombre).toBe("Nuevo Nombre");
    expect(mockRepo.updateById).toHaveBeenCalledWith(dummySupabase, "prod-1", { nombre: "Nuevo Nombre" });
    expect(mockRepo.getStocksByProductoId).toHaveBeenCalledWith(dummySupabase, "prod-1");
  });
});
