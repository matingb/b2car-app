import { Taller } from "@/model/types";

export interface GetTalleresResponse {
    data: Taller[] | null;
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
};