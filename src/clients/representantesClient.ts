import { Representante } from "@/model/types";

export type GetRepresentantesResponse = {
  data: Representante[] | null;
  error?: string | null;
};

export type CreateRepresentanteInput = {
  nombre: string;
  apellido?: string;
  telefono?: string;
};

export const representantesClient = {
  async getByEmpresaId(empresaId: string | number): Promise<GetRepresentantesResponse> {
    try {
      const res = await fetch(`/api/clientes/empresas/${empresaId}/representantes`);
      const body: GetRepresentantesResponse = await res.json();
      if (!res.ok) {
        return { data: null, error: body?.error || `Error ${res.status}` };
      }
      return { data: body.data || [], error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los representantes";
      return { data: null, error: message };
    }
  },

  async create(empresaId: string | number, input: CreateRepresentanteInput): Promise<{ data: Representante | null; error?: string | null }> {
    try {
      const res = await fetch(`/api/clientes/empresas/${empresaId}/representantes`, {
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
      const message = err instanceof Error ? err.message : "No se pudo crear el representante";
      return { data: null, error: message };
    }
  },
};
