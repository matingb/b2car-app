import type { Operacion, OperacionesFilters, TipoOperacion } from "@/model/types";
import { generateUuidV4 } from "@/lib/uuid";

export type CreateOperacionLineaInput = {
	stock_id: string;
	cantidad: number;
	monto_unitario: number;
	delta_cantidad: number;
};

export type CreateOperacionInput = {
	tipo: TipoOperacion;
	taller_id: string;
	fecha?: string;
	created_at?: string;
	lineas?: CreateOperacionLineaInput[];
	arreglo_id?: string | null;
	/** Cuenta que registra el ingreso (venta) o el egreso (compra). */
	cuenta_financiera_id?: string | null;
	/** Protege reintentos del navegador contra asientos duplicados. */
	idempotency_key?: string | null;
};

export type UpdateOperacionInput = Partial<Omit<CreateOperacionInput, "arreglo_id">>;

export type GetOperacionesResponse = {
	data: Operacion[] | null;
	pagination?: OperacionesPagination;
	error?: string | null;
};

export type OperacionesPagination = {
	page: number;
	pageSize: number;
	total: number;
};

export const OPERACIONES_PAGE_SIZE = 50;

export type GetOperacionByIdResponse = {
	data: Operacion | null;
	error?: string | null;
};

export type CreateOperacionResponse = {
	data: Operacion | null;
	error?: string | null;
};

export type UpdateOperacionResponse = {
	data: Operacion | null;
	error?: string | null;
};

export type OperacionesStats = {
	ventas: number;
	compras: number;
	asignaciones: number;
	cobros: number;
	gastos: number;
	neto: number;
};

export type GetOperacionesStatsResponse = {
	data: OperacionesStats | null;
	error?: string | null;
};

function mapOperacionFromApi(value: unknown): Operacion | null {
	if (!value || typeof value !== "object") return null;
	const o = value as Record<string, unknown>;
	return {
		...(o as unknown as Operacion),
		tipo: (o.tipo as TipoOperacion) ?? "AJUSTE",
		lineas: Array.isArray(o.lineas) ? (o.lineas as Operacion["lineas"]) : [],
	};
}

export const operacionesClient = {
	async getAll(
		filters?: OperacionesFilters,
		options?: { signal?: AbortSignal; page?: number }
	): Promise<GetOperacionesResponse> {
		try {
			const queryParams = new URLSearchParams();
			if (filters?.fecha) queryParams.append("fecha", filters.fecha);
			if (filters?.from) queryParams.append("from", filters.from);
			if (filters?.to) queryParams.append("to", filters.to);
			if (Array.isArray(filters?.tipo) && filters.tipo.length > 0) {
				filters.tipo.forEach((t) => queryParams.append("tipo", t));
			}
			queryParams.append("page", String(Math.max(1, options?.page ?? 1)));

			const qs = queryParams.toString();
			const res = await fetch(qs ? `/api/operaciones?${qs}` : "/api/operaciones", {
				signal: options?.signal,
			});
			const body: GetOperacionesResponse = await res.json();
			if (!res.ok) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			const mapped = Array.isArray(body.data)
				? body.data.map((o) => mapOperacionFromApi(o)).filter(Boolean) as Operacion[]
				: [];
			return {
				data: mapped,
				pagination: body.pagination ?? {
					page: Math.max(1, options?.page ?? 1),
					pageSize: OPERACIONES_PAGE_SIZE,
					total: mapped.length,
				},
				error: null,
			};
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return { data: null, error: null };
			}
			const message = err instanceof Error ? err.message : "Error cargando operaciones";
			return { data: null, error: message };
		}
	},

	async getById(id: string | number): Promise<GetOperacionByIdResponse> {
		try {
			const res = await fetch(`/api/operaciones/${id}`);
			const body: GetOperacionByIdResponse = await res.json();
			if (!res.ok) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			return {
				data: mapOperacionFromApi(body.data),
				error: null,
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error cargando operación";
			return { data: null, error: message };
		}
	},

	async create(input: CreateOperacionInput): Promise<CreateOperacionResponse | null> {
		try {
			const payload: CreateOperacionInput = {
				...input,
				idempotency_key: input.idempotency_key ?? generateUuidV4(),
			};
			const res = await fetch("/api/operaciones", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok || body?.error) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			return { data: mapOperacionFromApi(body.data), error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "No se pudo crear la operación";
			return { data: null, error: message };
		}
	},

	async update(id: string | number, input: UpdateOperacionInput): Promise<UpdateOperacionResponse> {
		try {
			const payload: UpdateOperacionInput = {
				...input,
				idempotency_key: input.idempotency_key ?? generateUuidV4(),
			};
			const res = await fetch(`/api/operaciones/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok || body?.error) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			return { data: mapOperacionFromApi(body.data), error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "No se pudo actualizar la operación";
			return { data: null, error: message };
		}
	},

	async delete(id: string | number): Promise<{ error?: string | null }> {
		try {
			const idempotencyKey = generateUuidV4();
			const res = await fetch(`/api/operaciones/${id}`, {
				method: "DELETE",
				headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : undefined,
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok || body?.error) {
				throw new Error(body?.error || `Error ${res.status}`);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "No se pudo eliminar la operación";
			throw new Error(message);
		}
		return { error: null };
	},

	async getStats(
		filters?: OperacionesFilters,
		options?: { signal?: AbortSignal }
	): Promise<GetOperacionesStatsResponse> {
		try {
			const queryParams = new URLSearchParams();
			if (filters?.fecha) queryParams.append("fecha", filters.fecha);
			if (filters?.from) queryParams.append("from", filters.from);
			if (filters?.to) queryParams.append("to", filters.to);
			if (Array.isArray(filters?.tipo) && filters.tipo.length > 0) {
				filters.tipo.forEach((t) => queryParams.append("tipo", t));
			}

			const qs = queryParams.toString();
			const res = await fetch(qs ? `/api/operaciones/stats?${qs}` : "/api/operaciones/stats", {
				signal: options?.signal,
			});
			const body: GetOperacionesStatsResponse = await res.json();
			if (!res.ok) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			return { data: body?.data ?? null, error: null };
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return { data: null, error: null };
			}
			const message = err instanceof Error ? err.message : "Error cargando estadísticas";
			return { data: null, error: message };
		}
	},
};
