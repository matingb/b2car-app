export type StockStatus = "bajo" | "normal" | "alto" | "critico";

export type StockLevels = {
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  stockDisponible?: number | null;
  stockReservado?: number | null;
  stockPendiente?: number | null;
};

export type ProductoStockBreakdown = {
  fisico: number;
  disponible: number;
  reservado: number;
  pendiente: number;
};

export type ProductoStockItem = {
  tallerId?: string;
  stockActual?: number | null;
  stockDisponible?: number | null;
  stockReservado?: number | null;
  stockPendiente?: number | null;
};

export type ProductoWithStocks = {
  stocks?: ProductoStockItem[] | null;
};

export function isValidStockLevels(levels: StockLevels): boolean {
  return (
    levels.stockActual >= 0 &&
    levels.stockMinimo >= 0 &&
    levels.stockMaximo >= 0 &&
    (levels.stockMinimo <= levels.stockMaximo || levels.stockMaximo === 0)
  );
}

export function getStockCalculado(levels: StockLevels): number {
  const reservado = Number(levels.stockReservado) || 0;

  const disponible =
    levels.stockDisponible != null
      ? Number(levels.stockDisponible) || 0
      : (Number(levels.stockActual) || 0) - reservado;

  const pendiente = Number(levels.stockPendiente) || 0;

  return disponible - reservado + pendiente;
}

export function getStockStatus(levels: StockLevels): StockStatus {
  const cuenta = getStockCalculado(levels);
  if (cuenta <= 0) return "critico";
  if (cuenta < levels.stockMinimo) return "bajo";
  if (levels.stockMaximo > 0 && cuenta > levels.stockMaximo) return "alto";
  return "normal";
}

export function getStockPercentage(levels: StockLevels): number {
  if (!levels.stockMaximo || levels.stockMaximo <= 0) return 0;
  return Math.min((levels.stockActual / levels.stockMaximo) * 100, 100);
}

export function getStockStatusLabel(status: StockStatus): string {
  switch (status) {
    case "critico":
      return "Sin stock";
    case "bajo":
      return "Stock bajo";
    case "alto":
      return "Exceso stock";
    case "normal":
      return "Stock normal";
  }
}

export function getStockBreakdown(
  stock?: ProductoStockItem | null,
  stockActualOverride?: number
): ProductoStockBreakdown {
  if (!stock && stockActualOverride === undefined) {
    return { fisico: 0, disponible: 0, reservado: 0, pendiente: 0 };
  }
  const actual = stockActualOverride ?? (Number(stock?.stockActual) || 0);
  const reservado = Number(stock?.stockReservado) || 0;
  const disponible =
    stockActualOverride === undefined && stock?.stockDisponible != null
      ? Number(stock.stockDisponible) || 0
      : actual - reservado;
  const pendiente = Number(stock?.stockPendiente) || 0;

  return {
    fisico: actual,
    disponible,
    reservado,
    pendiente,
  };
}

export function getProductoStockBreakdown(
  producto?: ProductoWithStocks | null,
  tallerId: string = ""
): ProductoStockBreakdown {
  const stocks = producto?.stocks ?? [];
  const relevantStocks = tallerId
    ? stocks.filter((s) => s.tallerId === tallerId)
    : stocks;

  return relevantStocks.reduce(
    (acc, s) => {
      const breakdown = getStockBreakdown(s);
      return {
        fisico: acc.fisico + breakdown.fisico,
        disponible: acc.disponible + breakdown.disponible,
        reservado: acc.reservado + breakdown.reservado,
        pendiente: acc.pendiente + breakdown.pendiente,
      };
    },
    { fisico: 0, disponible: 0, reservado: 0, pendiente: 0 }
  );
}
