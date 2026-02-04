import type {
  GetStockByIdResponse,
  GetStocksResponse,
  UpdateStockRequest,
  UpdateStockResponse,
  UpsertStockRequest,
  UpsertStockResponse,
} from "@/app/api/stocks/contracts";
import { logger } from "@/lib/logger";

export const stocksClient = {
  async getAll(): Promise<GetStocksResponse> {
    try {
      const res = await fetch(`/api/stocks`);
      const body: GetStocksResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando stocks";
      return { data: null, error: message };
    }
  },

  async getByTaller(params: { tallerId: string }): Promise<GetStocksResponse> {
    try {
      const tallerId = params.tallerId.trim();
      const res = await fetch(`/api/stocks?tallerId=${encodeURIComponent(tallerId)}`);
      const body: GetStocksResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando stocks";
      return { data: null, error: message };
    }
  },

  async getById(id: string): Promise<GetStockByIdResponse> {
    try {
      const res = await fetch(`/api/stocks/${id}`);
      const body: GetStockByIdResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando stock";
      return { data: null, error: message };
    }
  },

  async upsert(input: UpsertStockRequest): Promise<UpsertStockResponse> {
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      logger.debug("Upsert stock fetch response:", res);
      const body: UpsertStockResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok  || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el stock";
      return { data: null, error: message };
    }
  },

  async update(id: string, input: UpdateStockRequest): Promise<UpdateStockResponse> {
    try {
      const res = await fetch(`/api/stocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpdateStockResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el stock";
      return { data: null, error: message };
    }
  },

  async delete(id: string): Promise<{ error?: string | null }> {
    try {
      const res = await fetch(`/api/stocks/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el stock";
      return { error: message };
    }
  },
};

