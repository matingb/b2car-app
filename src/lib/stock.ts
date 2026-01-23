import type { StockItem } from "@/model/stock";

export type StockStatus = "bajo" | "normal" | "alto" | "critico";

export function getStockStatus(item: StockItem): StockStatus {
  if (item.stockActual === 0) return "critico";
  if (item.stockActual < item.stockMinimo) return "bajo";
  if (item.stockActual > item.stockMaximo) return "alto";
  return "normal";
}

export function getStockPercentage(item: StockItem): number {
  if (!item.stockMaximo || item.stockMaximo <= 0) return 0;
  return Math.min((item.stockActual / item.stockMaximo) * 100, 100);
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

