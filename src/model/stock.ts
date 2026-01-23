export type StockMovementType = "entrada" | "salida";

export type StockMovement = {
  fecha: string;
  tipo: StockMovementType;
  cantidad: number;
  motivo: string;
};

export type StockItem = {
  id: string;
  nombre: string;
  codigo: string;
  categorias: string[];
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  precioCompra: number;
  precioVenta: number;
  proveedor: string;
  ubicacion: string;
  ultimaActualizacion: string;
  historialMovimientos: StockMovement[];
};

