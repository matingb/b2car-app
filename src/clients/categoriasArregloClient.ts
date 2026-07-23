import type {
  CreateCategoriaArregloRequest,
  CreateCategoriaArregloResponse,
  GetCategoriasArregloResponse,
} from "@/app/api/categorias-arreglo/route";
import type {
  UpdateCategoriaArregloRequest,
  UpdateCategoriaArregloResponse,
  DeleteCategoriaArregloResponse,
} from "@/app/api/categorias-arreglo/[id]/route";

export const categoriasArregloClient = {
  async getAll(): Promise<GetCategoriasArregloResponse> {
    try {
      const url = `/api/categorias-arreglo`;
      const res = await fetch(url);
      const body: GetCategoriasArregloResponse = await res.json();
      if (!res.ok) {
        return { data: [], error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando categorías de arreglo";
      return { data: [], error: message };
    }
  },

  async create(input: CreateCategoriaArregloRequest): Promise<CreateCategoriaArregloResponse> {
    try {
      const res = await fetch("/api/categorias-arreglo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: CreateCategoriaArregloResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear la categoría de arreglo";
      return { data: null, error: message };
    }
  },

  async update(id: string, input: UpdateCategoriaArregloRequest): Promise<UpdateCategoriaArregloResponse> {
    try {
      const res = await fetch(`/api/categorias-arreglo/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpdateCategoriaArregloResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la categoría de arreglo";
      return { data: null, error: message };
    }
  },

  async delete(id: string): Promise<DeleteCategoriaArregloResponse> {
    try {
      const res = await fetch(`/api/categorias-arreglo/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar la categoría de arreglo";
      return { error: message };
    }
  },
};
