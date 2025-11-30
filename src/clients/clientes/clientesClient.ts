import { Cliente } from "@/model/types";

export type GetClientesResponse = {
  data: Cliente[] | null;
  error?: string | null;
};

export type DeleteClienteResponse = {
  id?: number;
  error?: string | null;
};

/**
 * Cliente para operaciones generales de clientes
 */
export const clientesClient = {
  /**
   * Obtiene todos los clientes (particulares y empresas)
   * @returns Objeto con data (array de clientes) o error
   */
  async getAll(): Promise<GetClientesResponse> {
    try {
      const res = await fetch("/api/clientes");
      const body: GetClientesResponse = await res.json();
      
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || `Error ${res.status}`,
        };
      }
      
      return {
        data: body.data || [],
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando clientes";
      return {
        data: null,
        error: message,
      };
    }
  },
};

