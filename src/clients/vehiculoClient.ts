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

/**
 * Cliente para operaciones de vehículos
 */
export const vehiculoClient = {
  /**
   * Obtiene un vehículo por su ID junto con sus arreglos
   * @param id - ID del vehículo
   * @returns Objeto con data (vehículo y arreglos) o error
   */
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
      const message = err instanceof Error ? err.message : "No se pudo cargar el vehículo";
      return {
        data: null,
        error: message,
      };
    }
  },

  /**
   * Obtiene todos los vehículos
   * @returns Objeto con data (array de vehículos) o error
   */
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
      const message = err instanceof Error ? err.message : "Error cargando vehículos";
      return {
        data: null,
        error: message,
      };
    }
  },

  /**
   * Obtiene el cliente propietario de un vehículo
   * @param vehiculoId - ID del vehículo
   * @returns Objeto con data (cliente) o error
   */
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
};

