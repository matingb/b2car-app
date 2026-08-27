import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo } from "@/model/types";
import type { CreateArregloInsertPayload, UpdateArregloRequest } from "./arregloRequests";
import { ServiceError, ServiceResult } from "@/app/api/serviceError";
import {
  type ArregloListFilters,
  type ArreglosResumen,
  type ArregloRepository,
  type DesgloseLinea,
  supabaseArregloRepository,
} from "./arregloRepository";

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

export function createArregloService(repository: ArregloRepository) {
  return {
    async getArreglo(
      supabase: SupabaseClient,
      filters: ArregloListFilters
    ): Promise<ServiceResult<ArregloListPage>> {
      const { data, error } = await repository.getArreglo(supabase, filters);
      if (error) return { data: null, error };

      const items = (data?.rows ?? []) as unknown as Arreglo[];
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

    async arreglosResumen(
      supabase: SupabaseClient,
      fromISO?: string,
      toISO?: string,
      tallerId?: string
    ): Promise<ArreglosResumen> {
      return repository.arreglosResumen(supabase, fromISO, toISO, tallerId);
    },

    async facturacionPorTipo(
      supabase: SupabaseClient,
      fromISO?: string,
      toISO?: string,
      tallerId?: string
    ): Promise<DesgloseLinea[]> {
      return repository.facturacionPorTipo(supabase, fromISO, toISO, tallerId);
    },

    async facturacionPorEmpleado(
      supabase: SupabaseClient,
      fromISO?: string,
      toISO?: string,
      tallerId?: string
    ): Promise<DesgloseLinea[]> {
      return repository.facturacionPorEmpleado(supabase, fromISO, toISO, tallerId);
    },

    async costoPorTipo(
      supabase: SupabaseClient,
      fromISO?: string,
      toISO?: string,
      tallerId?: string
    ): Promise<DesgloseLinea[]> {
      return repository.costoPorTipo(supabase, fromISO, toISO, tallerId);
    },

    async costoPorEmpleado(
      supabase: SupabaseClient,
      fromISO: string,
      toISO: string,
      tallerId?: string
    ): Promise<DesgloseLinea[]> {
      return repository.costoPorEmpleado(supabase, fromISO, toISO, tallerId);
    },

    async listRecentActivities(
      supabase: SupabaseClient,
      limit: number,
      fromISO?: string,
      toISO?: string,
      tallerId?: string
    ): Promise<RecentActivity[]> {
      const rows = await repository.listRecentActivities(supabase, limit, fromISO, toISO, tallerId);
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

    async arreglosPorPeriodo(
      supabase: SupabaseClient,
      fromISO: string,
      toISO: string,
      tallerId?: string
    ): Promise<Array<{ label: string; cantidad: number }>> {
      return repository.arreglosPorPeriodo(supabase, fromISO, toISO, tallerId);
    },

    async ingresosPorPeriodo(
      supabase: SupabaseClient,
      fromISO: string,
      toISO: string,
      tallerId?: string
    ): Promise<Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>> {
      return repository.ingresosPorPeriodo(supabase, fromISO, toISO, tallerId);
    },

    async gastosPorPeriodo(
      supabase: SupabaseClient,
      fromISO: string,
      toISO: string,
      tallerId?: string
    ): Promise<Array<{ label: string; repuestos: number; sueldos: number; eventuales: number }>> {
      return repository.gastosPorPeriodo(supabase, fromISO, toISO, tallerId);
    },
  };
}

export const arregloService = createArregloService(supabaseArregloRepository);


