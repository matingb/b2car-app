import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ProductoRow } from "../productos/productosService";
import { logger } from "@/lib/logger";
import { ServiceError, toServiceError } from "@/app/api/serviceError";

export type StockRow = {
  id: string;
  tenant_id: string;
  taller_id: string;
  producto_id: string;
  cantidad: number;
  cantidad_reservada?: number;
  cantidad_pendiente?: number;
  cantidad_disponible?: number;
  stock_minimo: number;
  stock_maximo: number;
  created_at: string;
  updated_at: string;
};

export type StockItemRow = StockRow & {
  productos: ProductoRow;
};

export const stocksService = {
  async listAll(
    supabase: SupabaseClient
  ): Promise<{ data: StockItemRow[]; error: ServiceError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .order("updated_at", { ascending: false });

    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as StockItemRow[], error: null };
  },

  async listForTaller(
    supabase: SupabaseClient,
    tallerId: string 
  ): Promise<{ data: StockItemRow[]; error: ServiceError | null }> {
    const query = supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .eq("taller_id", tallerId)
      .order("updated_at", { ascending: false });

    const { data, error } = await query;
    logger.debug("error" , error);
    if (error) return { data: [], error: toServiceError(error) };
    return { data: (data ?? []) as unknown as StockItemRow[], error: null };
  },

  async getById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ data: StockItemRow | null; error: ServiceError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select(
        `*,productos(*)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: toServiceError(error) };
    if (!data) return { data: null, error: ServiceError.NotFound };
    return { data: data as StockItemRow, error: null };
  },

  async getByTallerProducto(
    supabase: SupabaseClient,
    taller_id: string,
    producto_id: string
  ): Promise<{ data: StockRow | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .eq("taller_id", taller_id)
      .eq("producto_id", producto_id)
      .maybeSingle();

    return { data: (data ?? null) as StockRow | null, error };
  },

  async create(
    supabase: SupabaseClient,
    input: Omit<StockRow, "id" | "tenant_id" | "created_at" | "updated_at">
  ): Promise<{ data: StockItemRow | null; error: PostgrestError | ServiceError | null }> {
    const { data: stockId, error } = await supabase.rpc("rpc_crear_stock", {
      p_taller_id: input.taller_id,
      p_producto_id: input.producto_id,
      p_cantidad_inicial: input.cantidad ?? 0,
      p_stock_minimo: input.stock_minimo ?? 0,
      p_stock_maximo: input.stock_maximo ?? 0,
    });
    if (error || !stockId) return { data: null, error };
    return this.getById(supabase, stockId as string);
  },


  async updateById(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<StockRow, "cantidad" | "stock_minimo" | "stock_maximo">>
  ): Promise<{ data: StockItemRow | null; error: ServiceError | PostgrestError | null }> {
    if (patch.cantidad !== undefined) {
      const { error: adjustError } = await supabase.rpc("rpc_ajustar_stock", {
        p_stock_id: id,
        p_cantidad_nueva: patch.cantidad,
        p_motivo: "Ajuste manual",
      });
      if (adjustError) return { data: null, error: toServiceError(adjustError) };
    }

    const limitsPatch: Partial<Pick<StockRow, "stock_minimo" | "stock_maximo">> = {};
    if (patch.stock_minimo !== undefined) limitsPatch.stock_minimo = patch.stock_minimo;
    if (patch.stock_maximo !== undefined) limitsPatch.stock_maximo = patch.stock_maximo;

    if (Object.keys(limitsPatch).length > 0) {
      const { error: updateError } = await supabase
        .from("stocks")
        .update(limitsPatch)
        .eq("id", id);
      if (updateError) return { data: null, error: updateError };
    }

    return this.getById(supabase, id);
  },

  async deleteById(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: ServiceError | PostgrestError | null }> {
    const { error } = await supabase.from("stocks").delete().eq("id", id);
    if (error) return { error };
    return { error: null };
  },
};

