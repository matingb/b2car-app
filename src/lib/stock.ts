export type StockStatus = "bajo" | "normal" | "alto" | "critico";

export type StockLevels = {
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
};

export function getStockStatus(levels: StockLevels): StockStatus {
  if (levels.stockActual === 0) return "critico";
  if (levels.stockActual < levels.stockMinimo) return "bajo";
  if (levels.stockActual > levels.stockMaximo) return "alto";
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

