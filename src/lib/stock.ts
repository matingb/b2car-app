export type StockStatus = "bajo" | "normal" | "alto" | "critico";

export type StockLevels = {
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
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

export function getStockStatus(levels: StockLevels): StockStatus {
  if (levels.stockActual === 0) return "critico";
  if (levels.stockActual < levels.stockMinimo) return "bajo";
  if (levels.stockMaximo > 0 && levels.stockActual > levels.stockMaximo) return "alto";
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
      const actual = Number(s.stockActual) || 0;
      const reservado = Number(s.stockReservado) || 0;
      const disponible =
        s.stockDisponible !== undefined && s.stockDisponible !== null
          ? Number(s.stockDisponible) || 0
          : Math.max(0, actual - reservado);
      const pendiente = Number(s.stockPendiente) || 0;

      return {
        fisico: acc.fisico + actual,
        disponible: acc.disponible + disponible,
        reservado: acc.reservado + reservado,
        pendiente: acc.pendiente + pendiente,
      };
    },
    { fisico: 0, disponible: 0, reservado: 0, pendiente: 0 }
  );
}
