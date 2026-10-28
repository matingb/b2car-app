import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";
import {
  type ClienteOperacionesRepository,
  supabaseClienteOperacionesRepository,
} from "./clienteOperacionesRepository";
import type { ClienteOperacionesResumen } from "@/model/dtos";

export function createClienteOperacionesService(
  repository: ClienteOperacionesRepository = supabaseClienteOperacionesRepository
) {
  return {
    async getOperaciones(
      supabase: SupabaseClient,
      clienteId: string
    ): Promise<{ data: ClienteOperacionesResumen | null; error: ServiceError | Error | null }> {
      if (!clienteId || typeof clienteId !== "string" || !clienteId.trim()) {
        return { data: null, error: ServiceError.Validation };
      }

      return repository.getOperaciones(supabase, clienteId.trim());
    },
  };
}

export const clienteOperacionesService = createClienteOperacionesService(
  supabaseClienteOperacionesRepository
);
