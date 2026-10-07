import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  productosExportRepository,
  type ProductosExportRepository,
} from "./productosExportRepository";
import {
  buildMultiSheetWorkbook,
  writeWorkbookBuffer,
  type ExcelSheetDef,
} from "@/lib/excel/excelExportBuilder";

export interface ProductoStockExportItem {
  codigo: string;
  nombre: string;
  cantidad: number;
}

export interface TallerStockExportGroup {
  tallerId: string;
  tallerNombre: string;
  items: ProductoStockExportItem[];
}

export interface ExportExcelResult {
  buffer: ArrayBuffer;
  filename: string;
}

export const productosExportService = {
  async exportInventarioExcel(
    supabase: SupabaseClient,
    repository: ProductosExportRepository = productosExportRepository
  ): Promise<{ data: ExportExcelResult | null; error: string | null }> {
    try {
      const { data: talleres, error: talleresError } =
        await repository.listTalleres(supabase);

      if (talleresError) {
        logger.error("Error en repositorio al obtener talleres:", talleresError);
        return { data: null, error: "Error al obtener talleres" };
      }

      const { data: stocks, error: stocksError } =
        await repository.listStocksConProductos(supabase);

      if (stocksError) {
        logger.error("Error en repositorio al obtener stocks:", stocksError);
        return { data: null, error: "Error al obtener datos de stock" };
      }

      const talleresList =
        talleres && talleres.length > 0 ? talleres : [{ id: "", nombre: "General" }];

      const sheets: ExcelSheetDef<ProductoStockExportItem>[] = talleresList.map((taller) => {
        const tallerStocks = (stocks ?? []).filter((s) => s.taller_id === taller.id);

        const items: ProductoStockExportItem[] = [];
        for (const s of tallerStocks) {
          const prod = Array.isArray(s.productos) ? s.productos[0] : s.productos;
          if (!prod) continue;
          items.push({
            codigo: prod.codigo ?? "",
            nombre: prod.nombre ?? "",
            cantidad: Number(s.cantidad) || 0,
          });
        }

        items.sort((a, b) => a.nombre.localeCompare(b.nombre));

        return {
          name: taller.nombre,
          columns: [
            { header: "Código", key: "codigo", width: 22 },
            { header: "Nombre", key: "nombre", width: 38 },
            { header: "Cantidad", key: "cantidad", width: 14, numFmt: "#,##0" },
          ],
          rows: items,
          freezeHeader: true,
          autoFilter: true,
        };
      });

      const workbook = buildMultiSheetWorkbook({
        creator: "B2Car",
        sheets,
      });

      const buffer = await writeWorkbookBuffer(workbook);
      const filename = `inventario_${new Date().toISOString().slice(0, 10)}`;

      return {
        data: {
          buffer,
          filename,
        },
        error: null,
      };
    } catch (err) {
      logger.error("Error inesperado en productosExportService.exportInventarioExcel:", err);
      return { data: null, error: "Error inesperado al generar exportación" };
    }
  },
};
