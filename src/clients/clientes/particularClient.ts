import { Cliente, TipoCliente } from "@/model/types";
import type { CreateParticularRequest, CreateParticularResponse } from "@/app/api/clientes/particulares/route";
import type { UpdateParticularRequest, UpdateParticularResponse, GetParticularByIdResponse } from "@/app/api/clientes/particulares/[id]/route";

/**
 * Cliente para operaciones de particulares
 */
export const particularClient = {
  /**
   * Obtiene un particular por su ID
   * @param id - ID del particular
   * @returns Objeto con data (particular) o error
   */
  async getById(id: string | number): Promise<GetParticularByIdResponse> {
    try {
      const res = await fetch(`/api/clientes/particulares/${id}`);
      const body: GetParticularByIdResponse = await res.json();
      
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || `Error ${res.status}`,
        };
      }
      
      return {
        data: body.data || null,
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el particular";
      return {
        data: null,
        error: message,
      };
    }
  },

  /**
   * Crea un nuevo particular
   * @param input - Datos del particular a crear
   * @returns Objeto con data (cliente creado) o error
   */
  async create(input: CreateParticularRequest): Promise<CreateParticularResponse> {
    try {
      const res = await fetch("/api/clientes/particulares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const body = await res.json();
      
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || "No se pudo crear el particular",
        };
      }

      // Mapear la respuesta a Cliente
      const particular = body.data;
      if (!particular) {
        return {
          data: null,
          error: null,
        };
      }

      const cliente: Cliente = {
        id: particular.id,
        nombre: `${particular.nombre} ${particular.apellido || ''}`.trim(),
        tipo_cliente: TipoCliente.PARTICULAR,
        telefono: particular.telefono,
        email: particular.email,
        direccion: particular.direccion,
      };
      
      return {
        data: cliente,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el particular";
      return {
        data: null,
        error: message,
      };
    }
  },

  async update(id: string | number, input: UpdateParticularRequest): Promise<UpdateParticularResponse> {
    try {
      const res = await fetch(`/api/clientes/particulares/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || "No se pudo actualizar el particular",
        };
      }
      return {
        data: body.data || null,
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el particular";
      return {
        data: null,
        error: message,
      };
    }
  },
};

