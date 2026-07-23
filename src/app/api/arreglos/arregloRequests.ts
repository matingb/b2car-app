import type { EstadoArreglo } from "@/model/types";

export type ArregloFormularioInputValue = {
  title: string;
  value: string | boolean | null;
};

export type ArregloFormularioLineaValue = {
  title: string;
  inputs: ArregloFormularioInputValue[];
};

export type CreateArregloDetalleFormularioInput = {
  formulario_id?: string;
  config_id?: string;
  costo: number;
  metadata: ArregloFormularioLineaValue[];
};

export type CreateArregloRepuestoNuevoInput = {
  codigo: string;
  nombre: string;
  precio_compra: number;
  precio_venta: number;
  cantidad: number;
  categoria_arreglo_id?: string | null;
  empleado_id?: string | null;
};

export type CreateArregloRequest = {
  vehiculo_id: string;
  taller_id: string;
  estado?: EstadoArreglo;
  kilometraje_leido?: number;
  fecha: Date | string;
  observaciones?: string;
  precio_final?: number;
  esta_pago?: boolean;
  extra_data?: string;

  // opcional: creación "completa" desde el modal (1 POST)
  detalles?: Array<{
    descripcion: string;
    cantidad: number;
    valor: number;
    categoria_arreglo_id?: string | null;
    empleado_id?: string | null;
  }>;
  repuestos?: Array<{
    stock_id: string;
    cantidad: number;
    monto_unitario: number;
    precio_compra?: number | null;
    categoria_arreglo_id?: string | null;
    empleado_id?: string | null;
  }>;
  repuestos_nuevos?: CreateArregloRepuestoNuevoInput[];
  detalle_formulario?: CreateArregloDetalleFormularioInput;
};

export type CreateArregloInsertPayload = {
  vehiculo_id: string;
  taller_id: string;
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
  estado?: EstadoArreglo;
  descripcion?: string;
  kilometraje_leido?: number;
  fecha?: string;
  observaciones?: string;
  precio_final?: number;
  esta_pago?: boolean;
  detalle_formulario?: CreateArregloDetalleFormularioInput;
};


