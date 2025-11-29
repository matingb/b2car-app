import { GetArregloByIdResponse, UpdateArregloResponse } from "@/app/api/arreglos/[id]/route";
import { CreateArregloResponse, GetArreglosResponse } from "@/app/api/arreglos/route";
import { Cliente, Vehiculo } from "@/model/types";


export type CreateArregloInput = {
  vehiculo_id: string | number;
  tipo: string;
  fecha: string;
  kilometraje_leido: number;
  precio_final: number;
  observaciones?: string;
  descripcion?: string;
  esta_pago?: boolean;
  extra_data?: string;
};

export type UpdateArregloInput = Partial<Omit<CreateArregloInput, "vehiculo_id">>;

export const arreglosClient = {
  async getAll(): Promise<GetArreglosResponse> {
    try {
      const res = await fetch("/api/arreglos");
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
      return {
        data: body.data,
        error: null,
      };
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

  async togglePago(id: string | number, esta_pago: boolean): Promise<{ error?: string | null }> {
    return this.update(id, { esta_pago });
  },
};
