import type {
  ActualizarCuentaFinancieraInput,
  ActualizarCuentaFinancieraResponse,
  ActualizarGastoFinancieroInput,
  ActualizarGastoFinancieroResponse,
  ActualizarTransferenciaFinancieraInput,
  ActualizarTransferenciaFinancieraResponse,
  CrearCuentaFinancieraInput,
  CrearCuentaFinancieraResponse,
  CrearGastoFinancieroInput,
  CrearGastoFinancieroResponse,
  CrearTransferenciaFinancieraInput,
  CrearTransferenciaFinancieraResponse,
  EliminarFinanzasResponse,
  FinanzasResponse,
  ListarCuentasFinancierasResponse,
  ListarGastosFinancierosInput,
  ListarGastosFinancierosResponse,
  ListarMovimientosFinancierosInput,
  ListarMovimientosFinancierosResponse,
  ObtenerCuentaFinancieraResponse,
  ObtenerGastoFinancieroResponse,
} from "@/model/finanzas";
import { generateUuidV4 } from "@/lib/uuid";

async function request<T>(
  url: string,
  init: RequestInit | undefined,
  fallbackMessage: string
): Promise<FinanzasResponse<T>> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as FinanzasResponse<T> | null;
    if (!response.ok || body?.error) {
      return { data: null, error: body?.error || `Error ${response.status}` };
    }
    return { data: body?.data ?? null, error: null };
  } catch (error: unknown) {
    return {
      data: null,
      error: error instanceof Error ? error.message : fallbackMessage,
    };
  }
}

async function remove(
  url: string,
  fallbackMessage: string,
  idempotencyKey = generateUuidV4()
): Promise<EliminarFinanzasResponse> {
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    const body = (await response.json().catch(() => null)) as EliminarFinanzasResponse | null;
    if (!response.ok || body?.error) {
      return { error: body?.error || `Error ${response.status}` };
    }
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : fallbackMessage };
  }
}

function jsonRequest(method: "POST" | "PUT", payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function withIdempotencyKey<T extends { idempotencyKey?: string }>(input: T): T {
  return input.idempotencyKey ? input : ({ ...input, idempotencyKey: generateUuidV4() } as T);
}

function toSearchParams(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

/** Cliente del navegador para el módulo de cuentas y gastos. */
export const finanzasClient = {
  async listarCuentas(): Promise<ListarCuentasFinancierasResponse> {
    const result = await request<ListarCuentasFinancierasResponse["data"]>(
      "/api/cuentas-financieras",
      undefined,
      "No se pudieron cargar las cuentas"
    );
    return { data: result.data ?? [], error: result.error };
  },

  async obtenerCuenta(id: string): Promise<ObtenerCuentaFinancieraResponse> {
    return request(`/api/cuentas-financieras/${encodeURIComponent(id)}`, undefined, "No se pudo cargar la cuenta");
  },

  async crearCuenta(input: CrearCuentaFinancieraInput): Promise<CrearCuentaFinancieraResponse> {
    return request(
      "/api/cuentas-financieras",
      jsonRequest("POST", withIdempotencyKey(input)),
      "No se pudo crear la cuenta"
    );
  },

  async actualizarCuenta(
    id: string,
    input: ActualizarCuentaFinancieraInput
  ): Promise<ActualizarCuentaFinancieraResponse> {
    return request(
      `/api/cuentas-financieras/${encodeURIComponent(id)}`,
      jsonRequest("PUT", input),
      "No se pudo actualizar la cuenta"
    );
  },

  async eliminarCuenta(id: string): Promise<EliminarFinanzasResponse> {
    return remove(`/api/cuentas-financieras/${encodeURIComponent(id)}`, "No se pudo eliminar la cuenta");
  },

  async listarMovimientos(
    cuentaId: string,
    filters: ListarMovimientosFinancierosInput = {}
  ): Promise<ListarMovimientosFinancierosResponse> {
    const query = toSearchParams(filters);
    const url = `/api/cuentas-financieras/${encodeURIComponent(cuentaId)}/movimientos${query ? `?${query}` : ""}`;
    const result = await request<ListarMovimientosFinancierosResponse["data"]>(
      url,
      undefined,
      "No se pudieron cargar los movimientos"
    );
    return { data: result.data ?? [], error: result.error };
  },

  async crearTransferencia(
    input: CrearTransferenciaFinancieraInput
  ): Promise<CrearTransferenciaFinancieraResponse> {
    return request(
      "/api/cuentas-financieras/transferencias",
      jsonRequest("POST", withIdempotencyKey(input)),
      "No se pudo registrar la transferencia"
    );
  },

  async actualizarTransferencia(
    id: string,
    input: ActualizarTransferenciaFinancieraInput
  ): Promise<ActualizarTransferenciaFinancieraResponse> {
    return request(
      `/api/cuentas-financieras/transferencias/${encodeURIComponent(id)}`,
      jsonRequest("PUT", withIdempotencyKey(input)),
      "No se pudo actualizar la transferencia"
    );
  },

  async eliminarTransferencia(id: string): Promise<EliminarFinanzasResponse> {
    return remove(
      `/api/cuentas-financieras/transferencias/${encodeURIComponent(id)}`,
      "No se pudo eliminar la transferencia"
    );
  },

  async listarGastos(
    filters: ListarGastosFinancierosInput = {}
  ): Promise<ListarGastosFinancierosResponse> {
    const query = toSearchParams(filters);
    const result = await request<ListarGastosFinancierosResponse["data"]>(
      `/api/gastos${query ? `?${query}` : ""}`,
      undefined,
      "No se pudieron cargar los gastos"
    );
    return { data: result.data ?? [], error: result.error };
  },

  async obtenerGasto(id: string): Promise<ObtenerGastoFinancieroResponse> {
    return request(`/api/gastos/${encodeURIComponent(id)}`, undefined, "No se pudo cargar el gasto");
  },

  async crearGasto(input: CrearGastoFinancieroInput): Promise<CrearGastoFinancieroResponse> {
    return request("/api/gastos", jsonRequest("POST", withIdempotencyKey(input)), "No se pudo registrar el gasto");
  },

  async actualizarGasto(
    id: string,
    input: ActualizarGastoFinancieroInput
  ): Promise<ActualizarGastoFinancieroResponse> {
    return request(
      `/api/gastos/${encodeURIComponent(id)}`,
      jsonRequest("PUT", withIdempotencyKey(input)),
      "No se pudo actualizar el gasto"
    );
  },

  async eliminarGasto(id: string): Promise<EliminarFinanzasResponse> {
    return remove(`/api/gastos/${encodeURIComponent(id)}`, "No se pudo eliminar el gasto");
  },
};
