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
  fisico: number;
  disponible: number;
  reservado: number;
  pendiente: number;
  precioCompra: number;
  precioVenta: number;
  cantidad?: number;
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

          const fisico = Number(s.cantidad) || 0;
          const reservado = Number(s.cantidad_reservada) || 0;
          const disponible =
            s.cantidad_disponible != null && Number.isFinite(Number(s.cantidad_disponible))
              ? Number(s.cantidad_disponible)
              : fisico - reservado;
          const pendiente = Number(s.cantidad_pendiente) || 0;
          const precioCompra = Number(prod.costo_unitario) || 0;
          const precioVenta = Number(prod.precio_unitario) || 0;

          items.push({
            codigo: prod.codigo ?? "",
            nombre: prod.nombre ?? "",
            fisico,
            disponible,
            reservado,
            pendiente,
            precioCompra,
            precioVenta,
            cantidad: fisico,
          });
        }

        items.sort((a, b) => a.nombre.localeCompare(b.nombre));

        return {
          name: taller.nombre,
          columns: [
            { header: "Código", key: "codigo", width: 22 },
            { header: "Nombre", key: "nombre", width: 38 },
            { header: "Físico", key: "fisico", width: 14, numFmt: "#,##0" },
            { header: "Disponible", key: "disponible", width: 14, numFmt: "#,##0" },
            { header: "Reservado", key: "reservado", width: 14, numFmt: "#,##0" },
            { header: "Pendiente", key: "pendiente", width: 14, numFmt: "#,##0" },
            { header: "Precio Compra", key: "precioCompra", width: 16, numFmt: "$#,##0.00" },
            { header: "Precio Venta", key: "precioVenta", width: 16, numFmt: "$#,##0.00" },
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
