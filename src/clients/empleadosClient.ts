import type {
  CreateEmpleadoRequest,
  CreateEmpleadoResponse,
  GetEmpleadoByIdResponse,
  GetEmpleadosResponse,
  GetSalarioHistorialResponse,
  UpdateEmpleadoRequest,
  UpdateEmpleadoResponse,
} from "@/app/api/empleados/contracts";

export const empleadosClient = {
  async getAll(filters?: { tallerId?: string }): Promise<GetEmpleadosResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.tallerId) params.set("tallerId", filters.tallerId);
      const qs = params.toString();
      const url = qs ? `/api/empleados?${qs}` : `/api/empleados`;
      const res = await fetch(url);
      const body: GetEmpleadosResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando empleados";
      return { data: null, error: message };
    }
  },

  async getById(id: string): Promise<GetEmpleadoByIdResponse> {
    try {
      const res = await fetch(`/api/empleados/${id}`);
      const body: GetEmpleadoByIdResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando empleado";
      return { data: null, error: message };
    }
  },

  async create(input: CreateEmpleadoRequest): Promise<CreateEmpleadoResponse> {
    try {
      const res = await fetch("/api/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: CreateEmpleadoResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el empleado";
      return { data: null, error: message };
    }
  },

  async update(id: string, input: UpdateEmpleadoRequest): Promise<UpdateEmpleadoResponse> {
    try {
      const res = await fetch(`/api/empleados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpdateEmpleadoResponse = await res
        .json()
        .catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el empleado";
      return { data: null, error: message };
    }
  },

  async getSalarioHistory(id: string): Promise<GetSalarioHistorialResponse> {
    try {
      const res = await fetch(`/api/empleados/${id}/salarios`);
      const body: GetSalarioHistorialResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando historial salarial";
      return { data: null, error: message };
    }
  },

  async delete(id: string): Promise<{ error?: string | null }> {
    try {
      const res = await fetch(`/api/empleados/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el empleado";
      return { error: message };
    }
  },
};
