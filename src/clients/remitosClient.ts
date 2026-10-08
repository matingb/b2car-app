import type {
  FacturaRemitos,
  RemitoDetalle,
  RemitoPreflight,
  RemitosConfiguracion,
  RemitosConfiguracionInput,
} from "@/lib/remitos/types";
import type { FacturasPaginadas } from "@/lib/facturacion/types";

type JsonBody<T> = { data?: T; error?: string | null; canManage?: boolean };

/** Ejecuta el request y propaga el mensaje de error de la API como `Error`. */
async function request<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<JsonBody<T> & { data: T }> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = (await response.json().catch(() => null)) as JsonBody<T> | null;
  if (!response.ok || !body || body.error) {
    throw new Error(body?.error || fallback);
  }
  return body as JsonBody<T> & { data: T };
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export type EmitirRemitoPayload = {
  idempotencyKey: string;
  clase: "R" | "X";
  arregloId: string | null;
  facturaId: string | null;
  destinatario: Record<string, unknown>;
  transportista: Record<string, unknown> | null;
  observaciones: string | null;
  lineas: Array<Record<string, unknown>>;
};

export const remitosClient = {
  async get(id: string): Promise<{ remito: RemitoDetalle; canManage: boolean }> {
    const body = await request<RemitoDetalle>(`/api/remitos/${id}`, undefined, "No se pudo cargar el remito");
    return { remito: body.data, canManage: body.canManage === true };
  },

  async preflight(facturaId?: string | null, arregloId?: string | null): Promise<RemitoPreflight> {
    const params = new URLSearchParams();
    if (facturaId) params.set("facturaId", facturaId);
    if (arregloId) params.set("arregloId", arregloId);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";
    return (await request<RemitoPreflight>(`/api/remitos/preflight${query}`, undefined, "No se pudo preparar el remito")).data;
  },

  async emitir(payload: EmitirRemitoPayload): Promise<string> {
    return (await request<{ id: string }>("/api/remitos", jsonInit("POST", payload), "No se pudo emitir el remito")).data.id;
  },

  async asociar(
    remitoId: string,
    payload: { facturaId: string; lineas: Array<{ remitoLineaId: string; facturaLineaId: string }> },
  ): Promise<string> {
    return (await request<{ id: string }>(
      `/api/remitos/${remitoId}/factura`,
      jsonInit("POST", payload),
      "No se pudo asociar el remito",
    )).data.id;
  },

  async getConfiguracion(): Promise<RemitosConfiguracion> {
    return (await request<RemitosConfiguracion>(
      "/api/remitos/configuracion",
      undefined,
      "No se pudo cargar la configuración de remitos",
    )).data;
  },

  async saveConfiguracion(input: RemitosConfiguracionInput): Promise<RemitosConfiguracion> {
    return (await request<RemitosConfiguracion>(
      "/api/remitos/configuracion",
      jsonInit("PUT", input),
      "No se pudo guardar la configuración de remitos",
    )).data;
  },

  async getFacturaRemitos(facturaId: string): Promise<FacturaRemitos> {
    return (await request<FacturaRemitos>(
      `/api/facturas/${facturaId}/remitos`,
      undefined,
      "No se pudieron cargar los remitos de la factura",
    )).data;
  },

  /** Facturas autorizadas del ambiente indicado, para asociar un remito. */
  async buscarFacturasAsociables(ambiente: string, search: string, signal?: AbortSignal): Promise<FacturasPaginadas> {
    const query = new URLSearchParams({ documentoTipo: "FACTURA", estado: "AUTORIZADA", ambiente, pageSize: "10" });
    if (search.trim()) query.set("search", search.trim());
    return (await request<FacturasPaginadas>(`/api/facturas?${query}`, { signal }, "No se pudieron buscar las facturas")).data;
  },
};
