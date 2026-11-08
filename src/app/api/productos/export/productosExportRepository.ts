import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface TallerExportEntity {
  id: string;
  nombre: string;
}

export interface RawStockExportEntity {
  taller_id: string;
  cantidad: number;
  cantidad_reservada?: number | null;
  cantidad_disponible?: number | null;
  cantidad_pendiente?: number | null;
  productos:
    | {
        codigo: string;
        nombre: string;
        costo_unitario?: number | null;
        precio_unitario?: number | null;
      }
    | {
        codigo: string;
        nombre: string;
        costo_unitario?: number | null;
        precio_unitario?: number | null;
      }[]
    | null;
}

export interface ProductosExportRepository {
  listTalleres(
    supabase: SupabaseClient
  ): Promise<{ data: TallerExportEntity[]; error: PostgrestError | null }>;
  listStocksConProductos(
    supabase: SupabaseClient
  ): Promise<{ data: RawStockExportEntity[]; error: PostgrestError | null }>;
}

export const productosExportRepository: ProductosExportRepository = {
  async listTalleres(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("talleres")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    return {
      data: (data ?? []) as TallerExportEntity[],
      error,
    };
  },

  async listStocksConProductos(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("stocks")
      .select(`
        taller_id,
        cantidad,
        cantidad_reservada,
        cantidad_disponible,
        cantidad_pendiente,
        productos!inner (
          codigo,
          nombre,
          costo_unitario,
          precio_unitario
        )
      `);

    return {
      data: (data ?? []) as unknown as RawStockExportEntity[],
      error,
    };
  },
};
