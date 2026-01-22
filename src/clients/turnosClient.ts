import { CreateTurnoInput, CreateTurnoResponse, GetTurnosResponse } from "@/app/api/turnos/turnosService";
import { SupabaseError, Turno } from "@/model/types";


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
          return { data: null, error: {message} };
        }
      },
};