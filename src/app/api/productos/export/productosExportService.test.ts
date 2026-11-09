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
  stock:
    | {
        cantidad?: number;
        cantidad_reservada?: number;
        cantidad_disponible?: number;
        cantidad_pendiente?: number;
      }
    | number = 0,
  precios: {
    costo_unitario?: number;
    precio_unitario?: number;
  } = {}
): RawStockExportEntity => {
  const stockObj = typeof stock === "number" ? { cantidad: stock } : stock;
  return {
    taller_id,
    cantidad: stockObj.cantidad ?? 0,
    cantidad_reservada: stockObj.cantidad_reservada ?? 0,
    cantidad_disponible: stockObj.cantidad_disponible,
    cantidad_pendiente: stockObj.cantidad_pendiente ?? 0,
    productos: {
      codigo,
      nombre,
      costo_unitario: precios.costo_unitario ?? 0,
      precio_unitario: precios.precio_unitario ?? 0,
    },
  };
};

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
  await workbook.xlsx.load(
    Buffer.from(buffer) as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]
  );
  return workbook;
}

function assertSheetRows(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  expectedRows: (string | number)[][]
) {
  const sheet = workbook.getWorksheet(sheetName);
  expect(sheet).toBeDefined();
  expect(sheet!.actualColumnCount).toBe(8);

  const rows: (string | number)[][] = [];
  sheet!.eachRow((row) => {
    rows.push([
      row.getCell(1).value as string,
      row.getCell(2).value as string,
      row.getCell(3).value as number,
      row.getCell(4).value as number,
      row.getCell(5).value as number,
      row.getCell(6).value as number,
      row.getCell(7).value as number,
      row.getCell(8).value as number,
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

  it("Dado varios talleres, arma un excel con una hoja por taller con todos los estados de stock y precios", async () => {
    // Given
    const mockRepo = createMockRepo({
      talleres: [
        { id: "t1", nombre: "Taller Norte" },
        { id: "t2", nombre: "Taller Sur" },
      ],
      stocks: [
        mockStock(
          "t1",
          "B2",
          "Batería 12V",
          { cantidad: 5, cantidad_reservada: 1, cantidad_disponible: 4, cantidad_pendiente: 2 },
          { costo_unitario: 4500, precio_unitario: 7000 }
        ),
        mockStock(
          "t1",
          "A1",
          "Aceite Sintético",
          { cantidad: 10, cantidad_reservada: 3, cantidad_pendiente: 0 }, // cantidad_disponible fallback
          { costo_unitario: 1200, precio_unitario: 2000 }
        ),
        mockStock(
          "t2",
          "F1",
          "Filtro de Aire",
          { cantidad: 3, cantidad_reservada: 0, cantidad_disponible: 3, cantidad_pendiente: 1 },
          { costo_unitario: 800, precio_unitario: 1500 }
        ),
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
      [
        "Código",
        "Nombre",
        "Físico",
        "Disponible",
        "Reservado",
        "Pendiente",
        "Precio Compra",
        "Precio Venta",
      ],
      ["A1", "Aceite Sintético", 10, 7, 3, 0, 1200, 2000],
      ["B2", "Batería 12V", 5, 4, 1, 2, 4500, 7000],
    ]);

    assertSheetRows(workbook, "Taller Sur", [
      [
        "Código",
        "Nombre",
        "Físico",
        "Disponible",
        "Reservado",
        "Pendiente",
        "Precio Compra",
        "Precio Venta",
      ],
      ["F1", "Filtro de Aire", 3, 3, 0, 1, 800, 1500],
    ]);
  });

  it("asigna 0 como default ante valores de precio o stock faltantes/nulos y hoja General si no hay talleres", async () => {
    const mockRepo = createMockRepo({
      talleres: [],
      stocks: [
        {
          taller_id: "",
          cantidad: 0,
          cantidad_reservada: null,
          cantidad_disponible: null,
          cantidad_pendiente: null,
          productos: {
            codigo: "N1",
            nombre: "Producto Sin Precios",
            costo_unitario: null,
            precio_unitario: null,
          },
        },
      ],
    });

    const { data } = await productosExportService.exportInventarioExcel(
      dummySupabase,
      mockRepo
    );

    expect(data).toBeDefined();
    const workbook = await loadWorkbook(data!.buffer);
    expect(workbook.worksheets).toHaveLength(1);

    assertSheetRows(workbook, "General", [
      [
        "Código",
        "Nombre",
        "Físico",
        "Disponible",
        "Reservado",
        "Pendiente",
        "Precio Compra",
        "Precio Venta",
      ],
      ["N1", "Producto Sin Precios", 0, 0, 0, 0, 0, 0],
    ]);
    // exceljs tarda en cargar en frío con la suite completa corriendo en paralelo (CI con pocos núcleos)
  }, 20_000);
});

