import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ServiceError } from "@/app/api/serviceError";
import {
  type CreateProveedorPayload,
  type ListProveedoresFilters,
  type ProveedorRepository,
  type ProveedorRow,
  type UpdateProveedorPayload,
  supabaseProveedorRepository,
} from "./proveedorRepository";

export type { ProveedorRow, ListProveedoresFilters, ProveedorRepository };

export type CreateProveedorInput = {
  nombre: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export type UpdateProveedorInput = {
  nombre?: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

function cleanString(val?: string | null): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createProveedorService(repository: ProveedorRepository) {
  return {
    async list(
      supabase: SupabaseClient,
      filters?: ListProveedoresFilters
    ): Promise<{ data: ProveedorRow[]; error: ServiceError | null; cause?: PostgrestError }> {
      const res = await repository.list(supabase, filters);
      if (res.error || !res.data || res.data.length === 0 || typeof repository.getSaldos !== "function") {
        return res;
      }

      try {
        const saldosRes = await repository.getSaldos(
          supabase,
          res.data.map((p) => p.id)
        );
        const saldosMap = saldosRes.data;
        if (!saldosMap) return res;

        const enriched = res.data.map((p) => ({
          ...p,
          saldo_pendiente: saldosMap.get(p.id)?.saldoPendiente ?? 0,
        }));
        return { data: enriched, error: null };
      } catch {
        return res;
      }
    },

    async getById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      return repository.getById(supabase, id);
    },

    async create(
      supabase: SupabaseClient,
      payload: CreateProveedorInput
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      const dbPayload: CreateProveedorPayload = {
        nombre: payload.nombre.trim(),
        cuit: cleanString(payload.cuit),
        telefono: cleanString(payload.telefono),
        email: cleanString(payload.email),
        direccion: cleanString(payload.direccion),
      };

      return repository.create(supabase, dbPayload);
    },

    async updateById(
      supabase: SupabaseClient,
      id: string,
      patch: UpdateProveedorInput
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      const payload: UpdateProveedorPayload = {};

      if (patch.nombre !== undefined) {
        payload.nombre = patch.nombre.trim();
      }
      if (patch.cuit !== undefined) {
        payload.cuit = cleanString(patch.cuit);
      }
      if (patch.telefono !== undefined) {
        payload.telefono = cleanString(patch.telefono);
      }
      if (patch.email !== undefined) {
        payload.email = cleanString(patch.email);
      }
      if (patch.direccion !== undefined) {
        payload.direccion = cleanString(patch.direccion);
      }

      return repository.updateById(supabase, id, payload);
    },

    async deleteById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ error: ServiceError | PostgrestError | null }> {
      return repository.deleteById(supabase, id);
    },

    async getCuentaCorriente(
      supabase: SupabaseClient,
      proveedorId: string
    ) {
      return repository.getCuentaCorriente(supabase, proveedorId);
    },
  };
}

export const proveedorService = createProveedorService(supabaseProveedorRepository);
