import type {
  ComprobanteRecibido,
  ComprobanteRecibidoInput,
  ComprobantesOperacion,
} from "@/lib/comprobantesRecibidos/types";

type ApiBody<T> = { data?: T | null; error?: string | null } | null;

async function request<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisá tu conexión e intentá nuevamente.");
  }
  const body = (await response.json().catch(() => null)) as ApiBody<T>;
  if (!response.ok || !body || body.error || body.data === undefined || body.data === null) {
    throw new Error(body?.error || fallback);
  }
  return body.data;
}

/** Facturas y retenciones recibidas de compras y gastos. Propaga el mensaje de error de la API. */
export const comprobantesRecibidosClient = {
  listByOperacion(operacionId: string): Promise<ComprobantesOperacion> {
    return request(
      `/api/operaciones/${encodeURIComponent(operacionId)}/comprobantes-recibidos`,
      {},
      "No se pudieron cargar las facturas y retenciones",
    );
  },

  getById(id: string): Promise<ComprobanteRecibido> {
    return request(`/api/comprobantes-recibidos/${encodeURIComponent(id)}`, {}, "No se pudo cargar el documento");
  },

  /**
   * Alta en una operación ya persistida. Reutilizar la misma `idempotencyKey` al reintentar
   * devuelve el documento ya guardado en lugar de duplicarlo.
   */
  create(operacionId: string, input: ComprobanteRecibidoInput, idempotencyKey: string): Promise<ComprobanteRecibido> {
    return request(
      `/api/operaciones/${encodeURIComponent(operacionId)}/comprobantes-recibidos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
      "No se pudo guardar el documento",
    );
  },

  update(id: string, input: ComprobanteRecibidoInput): Promise<ComprobanteRecibido> {
    return request(
      `/api/comprobantes-recibidos/${encodeURIComponent(id)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
      "No se pudo guardar el documento",
    );
  },

  async crearTurnoVencimiento(id: string): Promise<void> {
    await request(
      `/api/comprobantes-recibidos/${encodeURIComponent(id)}/vencimiento`,
      { method: "POST" },
      "No se pudo agregar el vencimiento al calendario",
    );
  },

  async remove(id: string): Promise<void> {
    await request(
      `/api/comprobantes-recibidos/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      "No se pudo eliminar el documento",
    );
  },
};
