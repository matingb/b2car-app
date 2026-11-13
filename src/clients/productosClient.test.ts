import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapStockDtoToInventario, productosClient } from "./productosClient";
import type { StockDTO } from "@/model/dtos";

describe("productosClient mapStockDtoToInventario", () => {
  it("mapea StockDTO a StockRegistro preservando stockReservado, stockPendiente y stockDisponible", () => {
    const dto: StockDTO = {
      id: "STK-1",
      productoId: "PROD-1",
      tallerId: "TAL-1",
      cantidad: 15,
      cantidad_reservada: 5,
      cantidad_disponible: 10,
      cantidad_pendiente: 3,
      stock_minimo: 2,
      stock_maximo: 20,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T12:00:00Z",
    };

    const registro = mapStockDtoToInventario(dto);

    expect(registro.stockActual).toBe(15);
    expect(registro.stockReservado).toBe(5);
    expect(registro.stockDisponible).toBe(10);
    expect(registro.stockPendiente).toBe(3);
    expect(registro.stockMinimo).toBe(2);
    expect(registro.stockMaximo).toBe(20);
  });

  it("calcula stockDisponible como cantidad - cantidad_reservada si cantidad_disponible es undefined o null", () => {
    const dto: StockDTO = {
      id: "STK-2",
      productoId: "PROD-2",
      tallerId: "TAL-2",
      cantidad: 8,
      cantidad_reservada: 3,
      stock_minimo: 0,
      stock_maximo: 10,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T12:00:00Z",
    };

    const registro = mapStockDtoToInventario(dto);

    expect(registro.stockActual).toBe(8);
    expect(registro.stockReservado).toBe(3);
    expect(registro.stockDisponible).toBe(5);
  });

  describe("delete", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("retorna error null si el endpoint responde 200", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ error: null }),
        })
      );

      const res = await productosClient.delete("prod-1");
      expect(res.error).toBeNull();
      expect(fetch).toHaveBeenCalledWith("/api/productos/prod-1", { method: "DELETE" });
    });

    it("retorna el mensaje de error si el endpoint responde con error 409", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ error: "No se puede eliminar el producto porque tiene movimientos de stock asociados" }),
        })
      );

      const res = await productosClient.delete("prod-1");
      expect(res.error).toBe("No se puede eliminar el producto porque tiene movimientos de stock asociados");
    });
  });
});

