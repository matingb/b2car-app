import type { Operacion, OperacionesFilters } from "@/model/types";

export type CreateOperacionInput = {
	tipo: string;
	taller_id: string;
	created_at?: string;
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

export const operacionesClient = {
	async getAll(filters?: OperacionesFilters): Promise<GetOperacionesResponse> {
		try {
			const queryParams = new URLSearchParams();
			if (filters?.fecha) queryParams.append("fecha", filters.fecha);
			if (filters?.from) queryParams.append("from", filters.from);
			if (filters?.to) queryParams.append("to", filters.to);
			if (Array.isArray(filters?.tipo) && filters.tipo.length > 0) {
				filters.tipo.forEach((t) => queryParams.append("tipo", t));
			}

			const qs = queryParams.toString();
			const res = await fetch(qs ? `/api/operaciones?${qs}` : "/api/operaciones");
			const body: GetOperacionesResponse = await res.json();
			if (!res.ok) {
				return { data: null, error: body?.error || `Error ${res.status}` };
			}
			return { data: body.data || [], error: null };
		} catch (err: unknown) {
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
				data: body.data,
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
			return { data: body.data || null, error: null };
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
			return { data: body.data || null, error: null };
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
};
