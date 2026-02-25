import type { EstadoArreglo } from "@/model/types";

export type CreateArregloRequest = {
  vehiculo_id: string;
  taller_id: string;
  tipo?: string;
  estado?: EstadoArreglo;
  descripcion?: string;
  kilometraje_leido?: number;
  fecha: Date | string;
  observaciones?: string;
  precio_final?: number;
  esta_pago?: boolean;
  extra_data?: string;

  // opcional: creación "completa" desde el modal (1 POST)
  detalles?: Array<{ descripcion: string; cantidad: number; valor: number }>;
  repuestos?: Array<{ stock_id: string; cantidad: number; monto_unitario: number }>;
};

export type CreateArregloInsertPayload = {
  vehiculo_id: string;
  taller_id: string;
  tipo: string;
  estado: EstadoArreglo;
  descripcion: string | null;
  kilometraje_leido: number;
  fecha: Date | string;
  observaciones: string | null;
  precio_final: number;
  precio_sin_iva: number;
  esta_pago: boolean;
  extra_data: string | null;
};

export type UpdateArregloRequest = {
  tipo?: string;
  estado?: EstadoArreglo;
  descripcion?: string;
  kilometraje_leido?: number;
  fecha?: string;
  observaciones?: string;
  precio_final?: number;
  esta_pago?: boolean;
};


