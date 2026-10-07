import type { DocumentoTipoFiltro, DocumentosPaginados } from "@/lib/documentos/types";

export type ListarDocumentosParams = {
  page?: number;
  pageSize?: number;
  tipo?: DocumentoTipoFiltro;
  estado?: string;
  ambiente?: string;
  desde?: string;
  hasta?: string;
  search?: string;
  clase?: "" | "R" | "X";
  factura?: "" | "con" | "sin";
};

export function documentosQuery(params: ListarDocumentosParams): URLSearchParams {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query;
}

export const documentosClient = {
  /** Listado unificado de facturas, notas y remitos. Propaga el mensaje de error de la API. */
  async list(params: ListarDocumentosParams, signal?: AbortSignal): Promise<DocumentosPaginados> {
    const response = await fetch(`/api/documentos?${documentosQuery(params)}`, { cache: "no-store", signal });
    const body = (await response.json().catch(() => null)) as { data?: DocumentosPaginados; error?: string | null } | null;
    if (!response.ok || !body?.data || body.error) {
      throw new Error(body?.error || "No se pudieron cargar los documentos");
    }
    return body.data;
  },
};
