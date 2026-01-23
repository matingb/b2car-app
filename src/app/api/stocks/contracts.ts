import type { ProductoDTO, StockDTO, StockItemDTO } from "@/model/dtos";

export type GetStocksResponse = {
  data: StockItemDTO[] | null;
  error?: string | null;
};

export type UpsertStockRequest = {
  tallerId: string;
  productoId: string;
  cantidad?: number;
  stock_minimo?: number;
  stock_maximo?: number;
};

export type UpsertStockResponse = {
  data: StockDTO | null;
  error?: string | null;
};

export type GetStockByIdResponse = {
  data: (StockDTO & { producto: ProductoDTO | null }) | null;
  error?: string | null;
};

export type UpdateStockRequest = Partial<{
  cantidad: number;
  stock_minimo: number;
  stock_maximo: number;
}>;

export type UpdateStockResponse = {
  data: StockDTO | null;
  error?: string | null;
};

