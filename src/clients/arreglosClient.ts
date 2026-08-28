import { GetArregloByIdResponse, UpdateArregloResponse } from "@/app/api/arreglos/[id]/route";
import { CreateArregloResponse, GetArreglosResponse } from "@/app/api/arreglos/route";
import type { CreateDetalleArregloResponse } from "@/app/api/arreglos/[id]/detalles/route";
import type { UpdateDetalleArregloResponse, DeleteDetalleArregloResponse } from "@/app/api/arreglos/[id]/detalles/[detalleId]/route";
import type { UpsertRepuestoLineaResponse, UpsertRepuestoRequest } from "@/app/api/arreglos/[id]/repuestos/route";
import type { DeleteRepuestoLineaResponse } from "@/app/api/arreglos/[id]/repuestos/[lineaId]/route";
import type {
  CreateArregloDetalleFormularioInput,
  CreateArregloRepuestoNuevoInput,
} from "@/app/api/arreglos/arregloRequests";
import type { EstadoArreglo } from "@/model/types";
import { generateUuidV4 } from "@/lib/uuid";

export type CreateArregloInput = {
  vehiculo_id: string | number;
  taller_id: string;
  estado?: EstadoArreglo;
  fecha: string;
  kilometraje_leido: number;
  precio_final: number;
  observaciones?: string;
  esta_pago?: boolean;
  /** Requerida si se registra el arreglo como cobrado al crearlo. */
  cuenta_financiera_id?: string | null;
  /** Fecha contable del cobro; por defecto se propone hoy en la UI. */
  fecha_cobro?: string | null;
  idempotency_key?: string | null;
  extra_data?: string;

  // opcional: creación completa (servicios + repuestos) en 1 POST
  detalles?: Array<{
    descripcion: string;
    cantidad: number;
    valor: number;
    categoria_arreglo_id?: string | null;
    empleado_id?: string | null;
  }>;
  repuestos?: Array<{
    stock_id: string;
    cantidad: number;
    monto_unitario: number;
    precio_compra?: number | null;
    categoria_arreglo_id?: string | null;
    empleado_id?: string | null;
  }>;
  repuestos_nuevos?: CreateArregloRepuestoNuevoInput[];
  detalle_formulario?: CreateArregloDetalleFormularioInput;
};

export type UpdateArregloInput = Partial<Omit<CreateArregloInput, "vehiculo_id" | "taller_id">>;

export type CobroPagoItemInput = {
  cuenta_financiera_id: string;
  monto: number;
  descripcion?: string | null;
};

export type CobrarArregloInput = {
  cuenta_financiera_id?: string;
  fecha_cobro: string;
  monto?: number | null;
  descripcion?: string | null;
  pagos?: CobroPagoItemInput[];
  idempotency_key?: string | null;
};

export type GetArreglosInput = {
  tallerId?: string;
  search?: string;
  patente?: string;
  estado?: string;
  estadoPago?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limit?: number;
};

export const arreglosClient = {
  async getAll(params?: GetArreglosInput): Promise<GetArreglosResponse> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.tallerId) searchParams.set("taller_id", params.tallerId);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.patente) searchParams.set("patente", params.patente);
      if (params?.estado) searchParams.set("estado", params.estado);
      if (params?.estadoPago) searchParams.set("estado_pago", params.estadoPago);
      if (params?.fechaDesde) searchParams.set("fecha_desde", params.fechaDesde);
      if (params?.fechaHasta) searchParams.set("fecha_hasta", params.fechaHasta);
      if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
      const query = searchParams.toString();
      const url = query ? `/api/arreglos?${query}` : "/api/arreglos";

      const res = await fetch(url);
      const body: GetArreglosResponse = await res.json();
      if (!res.ok) {
        return {
          data: null,
          page: body?.page ?? { hasMore: false },
          error: body?.error || `Error ${res.status}`
        };
      }
      return {
        data: body.data || [],
        page: body.page ?? { hasMore: false },
        error: null
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando arreglos";
      return {
        data: null,
        page: { hasMore: false },
        error: message
      };
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
      const payload: CreateArregloInput = {
        ...input,
        idempotency_key: input.idempotency_key ?? generateUuidV4(),
      };
      const res = await fetch("/api/arreglos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async cobrar(
    id: string | number,
    input: CobrarArregloInput,
  ): Promise<UpdateArregloResponse> {
    try {
      const payload: CobrarArregloInput = {
        ...input,
        idempotency_key: input.idempotency_key ?? generateUuidV4(),
      };
      const res = await fetch(`/api/arreglos/${id}/cobro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: UpdateArregloResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body.error) {
        return { data: null, error: body.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "No se pudo registrar el cobro" };
    }
  },

  async anularCobro(
    id: string | number,
    operacionId?: string | null,
  ): Promise<UpdateArregloResponse> {
    try {
      const headers: Record<string, string> = {};
      if (operacionId) {
        headers["x-operacion-id"] = operacionId;
      }
      const res = await fetch(`/api/arreglos/${id}/cobro`, {
        method: "DELETE",
        headers,
      });
      const body: UpdateArregloResponse = await res.json().catch(() => ({ data: null, error: `Error ${res.status}` }));
      if (!res.ok || body.error) {
        return { data: null, error: body.error || `Error ${res.status}` };
      }
      return { data: body.data ?? null, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "No se pudo anular el cobro" };
    }
  },

  async createDetalle(
    arregloId: string | number,
    input: {
      descripcion: string;
      cantidad: number;
      valor: number;
      categoria_arreglo_id?: string | null;
      empleado_id?: string | null;
    }
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
    patch: Partial<{
      descripcion: string;
      cantidad: number;
      valor: number;
      categoria_arreglo_id: string | null;
      empleado_id: string | null;
    }>
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
    input: UpsertRepuestoRequest
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
