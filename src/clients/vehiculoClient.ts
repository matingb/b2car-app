import { Vehiculo, Cliente, Arreglo } from "@/model/types";

export type GetVehiculoByIdResponse = {
  data: Vehiculo | null;
  arreglos?: Arreglo[];
  error?: string | null;
};

export type GetVehiculosResponse = {
  data: Vehiculo[] | null;
  error?: string | null;
};

export type GetClienteForVehiculoResponse = {
  data: Cliente | null;
  error?: string | null;
};

export type CreateVehiculoRequest = {
  cliente_id: string | number;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string;
  nro_interno?: string | null;
};

export type UpdateVehiculoRequest = Partial<
  Pick<CreateVehiculoRequest, "patente" | "marca" | "modelo" | "fecha_patente" | "nro_interno">
>;

export type CreateVehiculoResponse = {
  created_id?: number | null;
  error?: string | null;
};

export type UpdateVehiculoResponse = {
  data?: Vehiculo | null;
  error?: string | null;
};

export const vehiculoClient = {
  async getById(id: string | number): Promise<GetVehiculoByIdResponse> {
    try {
      const res = await fetch(`/api/vehiculos/${id}`);
      const body: GetVehiculoByIdResponse = await res.json();

      if (!res.ok) {
        return {
          data: null,
          error: body?.error || `Error ${res.status}`,
        };
      }

      return {
        data: body.data,
        arreglos: body.arreglos || [],
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el vehiculo";
      return {
        data: null,
        error: message,
      };
    }
  },

  async getAll(): Promise<GetVehiculosResponse> {
    try {
      const res = await fetch("/api/vehiculos");
      const body: GetVehiculosResponse = await res.json();

      if (!res.ok) {
        return {
          data: null,
          error: body?.error || `Error ${res.status}`,
        };
      }

      return {
        data: body.data || [],
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando vehiculos";
      return {
        data: null,
        error: message,
      };
    }
  },

  async getClienteForVehiculo(vehiculoId: string | number): Promise<GetClienteForVehiculoResponse> {
    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/cliente`);

      if (!res.ok) {
        return {
          data: null,
          error: `Error ${res.status}`,
        };
      }

      const body: GetClienteForVehiculoResponse = await res.json();

      return {
        data: body.data || null,
        error: body.error || null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el cliente";
      return {
        data: null,
        error: message,
      };
    }
  },

  async create(input: CreateVehiculoRequest): Promise<CreateVehiculoResponse> {
    try {
      const res = await fetch("/api/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || (body as any)?.error) {
        return { error: (body as any)?.error || `Error ${res.status}` };
      }
      return { created_id: (body as any).data.id || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear el vehiculo";
      return { error: message };
    }
  },

  async update(id: string | number, input: UpdateVehiculoRequest): Promise<UpdateVehiculoResponse> {
    try {
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok || (body as any)?.error) {
        return { data: null, error: (body as any)?.error || `Error ${res.status}` };
      }
      return { data: (body as any).data || null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el vehiculo";
      return { data: null, error: message };
    }
  },

  async delete(id: string | number): Promise<{ error?: string | null }> {
    try {
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));  
      if (!res.ok || (body as any)?.error) {
        return { error: (body as any)?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el vehiculo";
      return { error: message };
    }
  },

  async reassignOwner(id: string | number, clienteId: string | number): Promise<{ error?: string | null }> {
    try {
      const res = await fetch(`/api/vehiculos/${id}/cliente`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || (body as any)?.error) {
        return { error: (body as any)?.error || `Error ${res.status}` };
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo reasignar el propietario";
      return { error: message };
    }
  },
};
