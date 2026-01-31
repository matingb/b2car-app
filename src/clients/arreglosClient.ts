import { GetArregloByIdResponse, UpdateArregloResponse } from "@/app/api/arreglos/[id]/route";
import { CreateArregloResponse, GetArreglosResponse } from "@/app/api/arreglos/route";
import type { CreateDetalleArregloResponse } from "@/app/api/arreglos/[id]/detalles/route";
import type { UpdateDetalleArregloResponse, DeleteDetalleArregloResponse } from "@/app/api/arreglos/[id]/detalles/[detalleId]/route";
import type { UpsertRepuestoLineaResponse } from "@/app/api/arreglos/[id]/repuestos/route";
import type { DeleteRepuestoLineaResponse } from "@/app/api/arreglos/[id]/repuestos/[lineaId]/route";

export type CreateArregloInput = {
  vehiculo_id: string | number;
  taller_id: string;
  tipo: string;
  fecha: string;
  kilometraje_leido: number;
  precio_final: number;
  observaciones?: string;
  descripcion?: string;
  esta_pago?: boolean;
  extra_data?: string;
};

export type UpdateArregloInput = Partial<Omit<CreateArregloInput, "vehiculo_id" | "taller_id">>;

export const arreglosClient = {
  async getAll(params?: { tallerId?: string }): Promise<GetArreglosResponse> {
    try {
      const url = params?.tallerId
        ? `/api/arreglos?taller_id=${encodeURIComponent(params.tallerId)}`
        : "/api/arreglos";

      const res = await fetch(url);
      const body: GetArreglosResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando arreglos";
      return { data: null, error: message };
    }
  },

  async getById(id: string | number): Promise<GetArregloByIdResponse> {
    try {
      const res = await fetch(`/api/arreglos/${id}`);
      const body: GetArregloByIdResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando arreglo";
      return { data: null, error: message };
    }
  },

  async create(input: CreateArregloInput): Promise<CreateArregloResponse | null> {
    try {
      const res = await fetch("/api/arreglos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el arreglo";
      return { data: null, error: message };
    }
  },

  async update(id: string | number, input: UpdateArregloInput): Promise<UpdateArregloResponse> {
    try {
      const res = await fetch(`/api/arreglos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el arreglo";
      return { data: null, error: message };
    }
  },

  async delete(id: string | number): Promise<Promise<{ error?: string | null }>> {
    try {
      const res = await fetch(`/api/arreglos/${id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        throw new Error(body?.error || `Error ${res.status}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el arreglo";
      throw new Error(message);
    }
    return {error: null}
  },

  async togglePago(id: string | number, esta_pago: boolean): Promise<{ error?: string | null }> {
    return this.update(id, { esta_pago });
  },

  async createDetalle(
    arregloId: string | number,
    input: { descripcion: string; cantidad: number; valor: number }
  ): Promise<CreateDetalleArregloResponse> {
    try {
      const res = await fetch(`/api/arreglos/${arregloId}/detalles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: CreateDetalleArregloResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error creando servicio";
      return { data: null, error: message };
    }
  },

  async updateDetalle(
    arregloId: string | number,
    detalleId: string,
    patch: Partial<{ descripcion: string; cantidad: number; valor: number }>
  ): Promise<UpdateDetalleArregloResponse> {
    try {
      const res = await fetch(`/api/arreglos/${arregloId}/detalles/${detalleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body: UpdateDetalleArregloResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error actualizando servicio";
      return { data: null, error: message };
    }
  },

  async deleteDetalle(
    arregloId: string | number,
    detalleId: string
  ): Promise<DeleteDetalleArregloResponse> {
    try {
      const res = await fetch(`/api/arreglos/${arregloId}/detalles/${detalleId}`, {
        method: "DELETE",
      });
      const body: DeleteDetalleArregloResponse = await res.json().catch(() => ({ error: `Error ${res.status}` }));
      if (!res.ok) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error eliminando servicio";
      return { error: message };
    }
  },

  async upsertRepuestoLinea(
    arregloId: string | number,
    input: { taller_id: string; producto_id: string; cantidad: number; monto_unitario: number }
  ): Promise<UpsertRepuestoLineaResponse> {
    try {
      const res = await fetch(`/api/arreglos/${arregloId}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body: UpsertRepuestoLineaResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error guardando repuesto";
      return { data: null, error: message };
    }
  },

  async deleteRepuestoLinea(
    arregloId: string | number,
    lineaId: string
  ): Promise<DeleteRepuestoLineaResponse> {
    try {
      const res = await fetch(`/api/arreglos/${arregloId}/repuestos/${lineaId}`, {
        method: "DELETE",
      });
      const body: DeleteRepuestoLineaResponse = await res.json().catch(() => ({ error: `Error ${res.status}` }));
      if (!res.ok) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error eliminando repuesto";
      return { error: message };
    }
  },
};
