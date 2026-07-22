import type {
  CreateTipoArregloRequest,
  CreateTipoArregloResponse,
  GetTiposArregloResponse,
} from "@/app/api/tipos-arreglo/route";
import type {
  UpdateTipoArregloRequest,
  UpdateTipoArregloResponse,
  DeleteTipoArregloResponse,
} from "@/app/api/tipos-arreglo/[id]/route";

export const tiposArregloClient = {
  async getAll(filters?: { soloActivos?: boolean }): Promise<GetTiposArregloResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.soloActivos) params.set("solo_activos", "true");
      const qs = params.toString();
      const url = qs ? `/api/tipos-arreglo?${qs}` : `/api/tipos-arreglo`;
      const res = await fetch(url);
      const body: GetTiposArregloResponse = await res.json();
      if (!res.ok) {
        return { data: [], error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando tipos de arreglo";
      return { data: [], error: message };
    }
  },

  async create(input: CreateTipoArregloRequest): Promise<CreateTipoArregloResponse> {
    try {
      const res = await fetch("/api/tipos-arreglo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: CreateTipoArregloResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el tipo de arreglo";
      return { data: null, error: message };
    }
  },

  async update(id: string, input: UpdateTipoArregloRequest): Promise<UpdateTipoArregloResponse> {
    try {
      const res = await fetch(`/api/tipos-arreglo/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpdateTipoArregloResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el tipo de arreglo";
      return { data: null, error: message };
    }
  },

  async delete(id: string): Promise<DeleteTipoArregloResponse> {
    try {
      const res = await fetch(`/api/tipos-arreglo/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el tipo de arreglo";
      return { error: message };
    }
  },
};
