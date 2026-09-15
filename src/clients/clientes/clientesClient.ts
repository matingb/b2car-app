import { Cliente, ClienteMovimientoCuenta, ClienteResumenFinanciero } from "@/model/types";

export type GetClientesInput = {
  search?: string;
  tipo?: "particular" | "empresa";
  saldo?: "PENDIENTE" | "AL_DIA" | "A_FAVOR";
  limit?: number;
};

export type GetClientesResponse = {
  data: Cliente[] | null;
  page: {
    hasMore: boolean;
  };
  error?: string | null;
};

export type DeleteClienteResponse = {
  id?: number;
  error?: string | null;
};

export type GetClienteResumenFinancieroClientResponse = {
  data: ClienteResumenFinanciero | null;
  error?: string | null;
};

export type GetClienteCuentaCorrienteClientResponse = {
  data: ClienteMovimientoCuenta[] | null;
  error?: string | null;
};

/**
 * Cliente para operaciones generales de clientes
 */
export const clientesClient = {
  /**
   * Obtiene clientes (particulares y empresas) con soporte para paginación y filtros
   */
  async getAll(params?: GetClientesInput): Promise<GetClientesResponse> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.tipo) searchParams.set("tipo", params.tipo);
      if (params?.saldo) searchParams.set("saldo", params.saldo);
      if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
      const query = searchParams.toString();
      const url = query ? `/api/clientes?${query}` : "/api/clientes";

      const res = await fetch(url);
      const body: GetClientesResponse = await res.json();
      
      if (!res.ok) {
        return {
          data: null,
          page: body?.page ?? { hasMore: false },
          error: body?.error || `Error ${res.status}`,
        };
      }
      
      return {
        data: body.data || [],
        page: body.page ?? { hasMore: false },
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando clientes";
      return {
        data: null,
        page: { hasMore: false },
        error: message,
      };
    }
  },

  /**
   * Obtiene el resumen financiero consolidado (saldo deuda, saldo a facturar)
   */
  async getResumenFinanciero(clienteId: string): Promise<GetClienteResumenFinancieroClientResponse> {
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}/resumen-financiero`);
      const body = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "Error cargando resumen financiero" };
    }
  },

  /**
   * Obtiene los movimientos de cuenta corriente del cliente
   */
  async getCuentaCorriente(
    clienteId: string,
    filters?: { from?: string; to?: string }
  ): Promise<GetClienteCuentaCorrienteClientResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      const query = params.toString();
      const url = `/api/clientes/${encodeURIComponent(clienteId)}/cuenta-corriente${query ? `?${query}` : ""}`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? [], error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "Error cargando cuenta corriente" };
    }
  },
};
