import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import type { StockRow } from "../stocks/stocksService";
import {
  type ProductoRow,
  type ProductoWithStocksRow,
  type CreateProductoInput,
  type ProductoRepository,
  type ListProductosFilters,
  supabaseProductoRepository,
} from "./productoRepository";

export type {
  ProductoRow,
  ProductoWithStocksRow,
  CreateProductoInput,
  ProductoRepository,
  ListProductosFilters,
};

export function createProductosService(repo: ProductoRepository = supabaseProductoRepository) {
  return {
    async list(
      supabase: SupabaseClient,
      filters?: ListProductosFilters
    ): Promise<{ data: ProductoWithStocksRow[]; error: ServiceError | null }> {
      const { data, error } = await repo.list(supabase, filters);
      if (error) return { data: [], error: toServiceError(error) };
      return { data, error: null };
    },

    async getById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ data: ProductoRow | null; error: ServiceError | null }> {
      const { data, error } = await repo.getById(supabase, id);
      if (error) return { data: null, error: toServiceError(error) };
      if (!data) return { data: null, error: ServiceError.NotFound };
      return { data, error: null };
    },

    async getWithStocksById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ data: ProductoWithStocksRow | null; error: ServiceError | null }> {
      const { data: producto, error: prodError } = await repo.getById(supabase, id);
      if (prodError) return { data: null, error: toServiceError(prodError) };
      if (!producto) return { data: null, error: ServiceError.NotFound };

      const { data: stocks, error: stocksError } = await repo.getStocksByProductoId(supabase, id);
      if (stocksError) return { data: null, error: toServiceError(stocksError) };

      return {
        data: {
          ...producto,
          stocks: stocks ?? [],
          talleresConStock: (stocks ?? []).length,
        },
        error: null,
      };
    },

    async create(
      supabase: SupabaseClient,
      payload: CreateProductoInput
    ): Promise<{ data: ProductoRow | null; error: ServiceError | null }> {
      const { data, error } = await repo.create(supabase, payload);
      if (error) return { data: null, error: toServiceError(error) };
      return { data, error: null };
    },

    async updateById(
      supabase: SupabaseClient,
      id: string,
      patch: Partial<ProductoRow>
    ): Promise<{ data: ProductoRow | null; error: ServiceError | PostgrestError | null }> {
      const { data, error } = await repo.updateById(supabase, id, patch);
      if (error) return { data: null, error };
      if (!data) return { data: null, error: ServiceError.NotFound };
      return { data, error: null };
    },

    async updateWithStocksById(
      supabase: SupabaseClient,
      id: string,
      patch: Partial<ProductoRow>
    ): Promise<{ data: ProductoWithStocksRow | null; error: ServiceError | PostgrestError | null }> {
      const { data: updated, error: updateError } = await repo.updateById(supabase, id, patch);
      if (updateError) return { data: null, error: updateError };
      if (!updated) return { data: null, error: ServiceError.NotFound };

      const { data: stocks, error: stocksError } = await repo.getStocksByProductoId(supabase, id);
      if (stocksError) return { data: null, error: stocksError };

      return {
        data: {
          ...updated,
          stocks: stocks ?? [],
          talleresConStock: (stocks ?? []).length,
        },
        error: null,
      };
    },

    async deleteById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ error: ServiceError | PostgrestError | null }> {
      const { error } = await repo.deleteById(supabase, id);
      if (error) return { error };
      return { error: null };
    },
  };
}

export const productosService = createProductosService();
