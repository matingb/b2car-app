import { Taller } from "@/model/types";

export interface GetTalleresResponse {
  data: Taller[] | null;
  error: string | null;
}

export type UpdateTallerPatch = Partial<Pick<Taller, "nombre" | "ubicacion" | "valor_hora">>;

export interface UpdateTallerResponse {
  data: Taller | null;
  error: string | null;
}

export const tenantClient = {
  async getAll(): Promise<GetTalleresResponse> {
    try {
      const res = await fetch(`/api/tenant/taller`);
      const body: GetTalleresResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return {
        data: body.data,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando talleres";
      return { data: null, error: message };
    }
  },

  async updateTaller(id: string, patch: UpdateTallerPatch): Promise<UpdateTallerResponse> {
    try {
      const res = await fetch(`/api/tenant/taller/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body: UpdateTallerResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return {
        data: body.data,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al actualizar taller";
      return { data: null, error: message };
    }
  },
};