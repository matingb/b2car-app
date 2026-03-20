import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo } from "@/model/types";
import type { CreateArregloInsertPayload, UpdateArregloRequest } from "./arregloRequests";
import { ServiceError, ServiceResult } from "@/app/api/serviceError";
import { buildDescripcionFromDetalles } from "@/lib/arreglos";
import { logger } from "@/lib/logger";
import {
  type ArregloListFilters,
  type ArregloRepository,
  supabaseArregloRepository,
} from "./arregloRepository";

export type TiposConIngresos = {
  tipos: string[];
  cantidad: number[];
  ingresos: number[];
};

export type RecentActivity = {
  id: string;
  titulo: string;
  vehiculo: string;
  fechaUltimaActualizacion: string;
  monto: number;
};

export type ArregloListPage = {
  items: Arreglo[];
  hasMore: boolean;
};

function mapArregloDescripcion(row: {
  detalles?: Array<{ descripcion?: unknown }> | null;
  descripcion?: unknown;
  [key: string]: unknown;
}) {
  const { detalles, ...rest } = row;
  const fallback = String(row?.descripcion ?? "");
  return {
    ...rest,
    descripcion: buildDescripcionFromDetalles(detalles, fallback),
  };
}

export function createArregloService(repository: ArregloRepository) {
  return {
    async getArreglo(
      supabase: SupabaseClient,
      filters: ArregloListFilters
    ): Promise<ServiceResult<ArregloListPage>> {
      const { data, error } = await repository.getArreglo(supabase, filters);
      if (error) return { data: null, error };

      const items = (data?.rows ?? []).map(mapArregloDescripcion) as unknown as Arreglo[];
      return { data: { items, hasMore: Boolean(data?.hasMore) }, error: null };
    },

    async getByIdWithVehiculo(supabase: SupabaseClient, id: string): Promise<ServiceResult<Arreglo>> {
      return repository.getByIdWithVehiculo(supabase, id);
    },

    async create(
      supabase: SupabaseClient,
      payload: CreateArregloInsertPayload
    ): Promise<ServiceResult<Arreglo>> {
      return repository.create(supabase, payload);
    },

    async updateById(
      supabase: SupabaseClient,
      id: string,
      payload: UpdateArregloRequest
    ): Promise<ServiceResult<Arreglo>> {
      return repository.updateById(supabase, id, payload);
    },

    async deleteById(supabase: SupabaseClient, id: string): Promise<{ error: ServiceError | null }> {
      const { error } = await repository.deleteById(supabase, id);
      if (error) return { error };
      return { error: null };
    },

    async countAll(supabase: SupabaseClient): Promise<number> {
      return repository.countAll(supabase);
    },

    async countByPago(supabase: SupabaseClient, estaPago: boolean): Promise<number> {
      return repository.countByPago(supabase, estaPago);
    },

    async sumIngresos(supabase: SupabaseClient, fromISO: string, toISO: string): Promise<number> {
      return repository.sumIngresos(supabase, fromISO, toISO);
    },

    async tiposConIngresos(supabase: SupabaseClient): Promise<TiposConIngresos> {
      const rows = await repository.tiposConIngresos(supabase);
      const tipos: string[] = [];
      const cantidad: number[] = [];
      const ingresos: number[] = [];

      for (const r of rows) {
        tipos.push(String(r.tipo ?? "").trim() || "Sin tipo");
        cantidad.push(Number(r.cantidad ?? 0) || 0);
        ingresos.push(Number(Number(r.ingresos ?? 0).toFixed(2)) || 0);
      }

      return { tipos, cantidad, ingresos };
    },

    async listRecentActivities(supabase: SupabaseClient, limit: number): Promise<RecentActivity[]> {
      const rows = await repository.listRecentActivities(supabase, limit);
      return rows
        .map((r) => ({
          id: String(r.id ?? ""),
          titulo: String(r.descripcion ?? "").trim() || "Actividad",
          vehiculo: String(r.vehiculo?.patente ?? "").trim() || "-",
          fechaUltimaActualizacion: String(r.updated_at ?? ""),
          monto: Number(r.precio_final ?? 0) || 0,
        }))
        .filter((a) => a.id);
    },
  };
}

export const arregloService = createArregloService(supabaseArregloRepository);


