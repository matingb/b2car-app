import { CreateTurnoInput, CreateTurnoResponse, GetTurnosResponse, ListTurnosFilters, UpdateTurnoInput } from "@/app/api/turnos/turnosService";
import { SupabaseError } from "@/model/types";


export const turnosClient = {
    async create(input: CreateTurnoInput): Promise<CreateTurnoResponse> {
        try {
            const res = await fetch("/api/turnos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const body: CreateTurnoResponse = await res.json();
            if (!res.ok || body?.error) {
                return { error: body?.error || { message: `Error ${res.status}` }, data: null };
            }
            return { data: body.data || null, error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "No se pudo crear el turno";
            return { error: { message }, data: null };
        }
    },
    async update(input: UpdateTurnoInput): Promise<CreateTurnoResponse> {
        try {
            const res = await fetch(`/api/turnos/${input.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const body: CreateTurnoResponse = await res.json();
            if (!res.ok || body?.error) {
                return { error: body?.error || { message: `Error ${res.status}` }, data: null };
            }
            return { data: body.data || null, error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "No se pudo actualizar el turno";
            return { error: { message }, data: null };
        }
    },
    async delete(id: string): Promise<{ data: null; error: SupabaseError | null }> {
        try {
            const res = await fetch(`/api/turnos/${id}`, {
                method: "DELETE",
            });
            const body: { data: null; error: SupabaseError | null } = await res.json();
            if (!res.ok || body?.error) {
                return { error: body?.error || { message: `Error ${res.status}` }, data: null };
            }
            return { data: body.data || null, error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "No se pudo eliminar el turno";
            return { error: { message }, data: null };
        }
    },
    async getAll(): Promise<GetTurnosResponse> {
        try {
            const res = await fetch("/api/turnos");
            const body: GetTurnosResponse = await res.json();
            if (!res.ok) {
                return { data: null, error: body?.error || { message: `Error ${res.status}` } };
            }
            return { data: body.data || [], error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error cargando turnos";
            return { data: null, error: { message } };
        }
    },
    async getWithFilters(filters: ListTurnosFilters): Promise<GetTurnosResponse> {
        try {
            const queryParams = new URLSearchParams();
            if (filters.fecha) queryParams.append("fecha", filters.fecha);
            if (filters.from) queryParams.append("from", filters.from);
            if (filters.to) queryParams.append("to", filters.to);
            if (filters.estado) queryParams.append("estado", filters.estado);

            const res = await fetch(`/api/turnos?${queryParams.toString()}`);
            const body: GetTurnosResponse = await res.json();
            if (!res.ok) {
                return { data: null, error: body?.error || { message: `Error ${res.status}` } };
            }
            return { data: body.data || [], error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error cargando turnos";
            return { data: null, error: { message } };
        }
    },
};