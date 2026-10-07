import { describe, expect, it, vi } from "vitest";
import { productosExportService } from "./productosExportService";
import type {
  ProductosExportRepository,
  RawStockExportEntity,
  TallerExportEntity,
} from "./productosExportRepository";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const mockStock = (
  taller_id: string,
  codigo: string,
  nombre: string,
  cantidad: number
): RawStockExportEntity => ({
  taller_id,
  cantidad,
  productos: { codigo, nombre },
});

function createMockRepo(params: {
  talleres?: TallerExportEntity[];
  stocks?: RawStockExportEntity[];
  talleresError?: { message: string } | null;
  stocksError?: { message: string } | null;
} = {}): ProductosExportRepository {
  return {
    listTalleres: vi.fn().mockResolvedValue({
      data: params.talleres ?? [],
      error: (params.talleresError as PostgrestError) ?? null,
    }),
    listStocksConProductos: vi.fn().mockResolvedValue({
      data: params.stocks ?? [],
      error: (params.stocksError as PostgrestError) ?? null,
    }),
  };
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function assertSheetRows(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  expectedRows: (string | number)[][]
) {
  const sheet = workbook.getWorksheet(sheetName);
  expect(sheet).toBeDefined();
  expect(sheet!.actualColumnCount).toBe(3);

  const rows: (string | number)[][] = [];
  sheet!.eachRow((row) => {
    rows.push([
      row.getCell(1).value as string,
      row.getCell(2).value as string,
      row.getCell(3).value as number,
    ]);
  });
  expect(rows).toEqual(expectedRows);
}

describe("productosExportService (orquestador)", () => {
  const dummySupabase = {} as SupabaseClient;

  it("retorna error si falla el repositorio al consultar talleres", async () => {
    const mockRepo = createMockRepo({
      talleresError: { message: "Error DB talleres" },
    });

    const { data, error } = await productosExportService.exportInventarioExcel(
      dummySupabase,
      mockRepo
    );

    expect(data).toBeNull();
    expect(error).toBe("Error al obtener talleres");
  });

  it("retorna error si falla el repositorio al consultar stocks", async () => {
    const mockRepo = createMockRepo({
      talleres: [{ id: "t1", nombre: "Taller Uno" }],
      stocksError: { message: "Error DB stocks" },
    });

    const { data, error } = await productosExportService.exportInventarioExcel(
      dummySupabase,
      mockRepo
    );

    expect(data).toBeNull();
    expect(error).toBe("Error al obtener datos de stock");
  });

    it("Dado varios talleres, arma un excel con una hoja por talles con el stock de cada uno", async () => {
    // Given
    const mockRepo = createMockRepo({
      talleres: [
        { id: "t1", nombre: "Taller Norte" },
        { id: "t2", nombre: "Taller Sur" },
      ],
      stocks: [
        mockStock("t1", "B2", "Batería 12V", 5),
        mockStock("t1", "A1", "Aceite Sintético", 10),
        mockStock("t2", "F1", "Filtro de Aire", 3),
      ],
    });

    // When
    const { data } = await productosExportService.exportInventarioExcel(
      dummySupabase,
      mockRepo
    );

    // Then
    expect(data?.filename).toContain("inventario_");

    const workbook = await loadWorkbook(data!.buffer);
    expect(workbook.worksheets).toHaveLength(2);

    assertSheetRows(workbook, "Taller Norte", [
      ["Código", "Nombre", "Cantidad"],
      ["A1", "Aceite Sintético", 10],
      ["B2", "Batería 12V", 5],
    ]);

    assertSheetRows(workbook, "Taller Sur", [
      ["Código", "Nombre", "Cantidad"],
      ["F1", "Filtro de Aire", 3],
    ]);
  });
});

