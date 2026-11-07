export type StockMovementType = "entrada" | "salida";

export type StockMovement = {
  fecha: string;
  tipo: StockMovementType;
  cantidad: number;
  motivo: string;
};

export type StockItem = {
  id: string;
  productoId: string;
  tallerId: string;
  nombre: string;
  codigo: string;
  categorias: string[];
  stockActual: number;
  stockDisponible?: number;
  stockReservado?: number;
  stockPendiente?: number;
  stockMinimo: number;
  stockMaximo: number;
  costoUnitario: number;
  precioUnitario: number;
  showInStock: boolean;
  ultimaActualizacion: string;
  historialMovimientos: StockMovement[];
};

