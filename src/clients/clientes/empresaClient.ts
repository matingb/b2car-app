import { Cliente, TipoCliente } from "@/model/types";
import type { CreateEmpresaRequest, CreateEmpresaResponse } from "@/app/api/clientes/empresas/route";
import type { Empresa as EmpresaType, GetEmpresaByIdResponse, UpdateEmpresaRequest, UpdateEmpresaResponse } from "@/app/api/clientes/empresas/[id]/route";
import { DeleteClienteResponse } from "./clientesClient";

// Re-exportar el tipo Empresa para mantener compatibilidad con otros módulos
export type { EmpresaType as Empresa };

/**
 * Cliente para operaciones de empresas
 */
export const empresaClient = {
  /**
   * Obtiene una empresa por su ID
   * @param id - ID de la empresa
   * @returns Objeto con data (empresa) o error
   */
  async getById(id: string | number): Promise<GetEmpresaByIdResponse> {
    try {
      const res = await fetch(`/api/clientes/empresas/${id}`);
      const body: GetEmpresaByIdResponse = await res.json();
      
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
      const message = err instanceof Error ? err.message : "No se pudo cargar la empresa";
      return {
        data: null,
        error: message,
      };
    }
  },

  /**
   * Crea una nueva empresa
   * @param input - Datos de la empresa a crear
   * @returns Objeto con data (cliente creado) o error
   */
  async create(input: CreateEmpresaRequest): Promise<CreateEmpresaResponse> {
    try {
      const res = await fetch("/api/clientes/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const body = await res.json();
      
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || "No se pudo crear la empresa",
        };
      }

      // Mapear la respuesta a Cliente
      const empresa = body.data;
      if (!empresa) {
        return {
          data: null,
          error: null,
        };
      }

      const cliente: Cliente = {
        id: empresa.id,
        nombre: empresa.nombre,
        tipo_cliente: TipoCliente.EMPRESA,
        telefono: empresa.telefono,
        email: empresa.email,
        direccion: empresa.direccion,
        cuit: empresa.cuit,
      };
      
      return {
        data: cliente,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear la empresa";
      return {
        data: null,
        error: message,
      };
    }
  },

  async update(id: string | number, input: UpdateEmpresaRequest): Promise<UpdateEmpresaResponse> {
    try {
      const res = await fetch(`/api/clientes/empresas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        return {
          data: null,
          error: body?.error || "No se pudo actualizar la empresa",
        };
      }
      return {
        data: body.data || null,
        error: body.error || null,
      };
    }
    catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la empresa";
      return {
        data: null,
        error: message,
      };
    }
  },

  async delete(id: string | number): Promise<DeleteClienteResponse> {
    try {
      const res = await fetch(`/api/clientes/empresas/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        return { error: body?.error || `Error ${res.status}` };
      }
      return { id: Number(id), error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar la empresa";
      return { error: message };
    }
  },
};

