import { Cliente, ClienteMovimientoCuenta, ClienteResumenFinanciero } from "@/model/types";

export type GetClientesResponse = {
  data: Cliente[] | null;
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

