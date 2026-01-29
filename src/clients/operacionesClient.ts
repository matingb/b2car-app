import type { Operacion, OperacionesFilters, TipoOperacion } from "@/model/types";

export type CreateOperacionLineaInput = {
	producto_id: string;
	cantidad: number;
	monto_unitario: number;
	delta_cantidad: number;
};

export type CreateOperacionInput = {
	tipo: TipoOperacion;
	taller_id: string;
	created_at?: string;
	lineas?: CreateOperacionLineaInput[];
	arreglo_id?: string | null;
};

export type UpdateOperacionInput = Partial<CreateOperacionInput>;

export type GetOperacionesResponse = {
	data: Operacion[] | null;
	error?: string | null;
};

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
		options?: { signal?: AbortSignal }
	): Promise<GetOperacionesResponse> {
		try {
			const queryParams = new URLSearchParams();
			if (filters?.fecha) queryParams.append("fecha", filters.fecha);
			if (filters?.from) queryParams.append("from", filters.from);
			if (filters?.to) queryParams.append("to", filters.to);
			if (Array.isArray(filters?.tipo) && filters.tipo.length > 0) {
				filters.tipo.forEach((t) => queryParams.append("tipo", t));
			}

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
			return { data: mapped, error: null };
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
			const res = await fetch("/api/operaciones", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
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
			const res = await fetch(`/api/operaciones/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
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
			const res = await fetch(`/api/operaciones/${id}`, {
				method: "DELETE",
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
