import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  sanitizeSheetName,
  buildMultiSheetWorkbook,
  buildExcelResponse,
} from "./excelExportBuilder";

describe("excelExportBuilder", () => {
  describe("sanitizeSheetName", () => {
    it("limita a 31 caracteres y elimina caracteres prohibidos", () => {
      const usedNames = new Set<string>();
      const result = sanitizeSheetName("Taller / [Central] * Norte : Sur ?", 0, usedNames);
      expect(result).not.toMatch(/[\\/?*[\]:]/);
      expect(result.length).toBeLessThanOrEqual(31);
    });

    it("resuelve colisiones de nombres añadiendo sufijo único", () => {
      const usedNames = new Set<string>();
      const name1 = sanitizeSheetName("Sucursal", 0, usedNames);
      const name2 = sanitizeSheetName("Sucursal", 1, usedNames);
      const name3 = sanitizeSheetName("Sucursal", 2, usedNames);

      expect(name1).toBe("Sucursal");
      expect(name2).toBe("Sucursal (1)");
      expect(name3).toBe("Sucursal (2)");
    });
  });

  describe("buildMultiSheetWorkbook", () => {
    it("crea un libro con las hojas y columnas especificadas sin extender columnas fantasma", async () => {
      const workbook = buildMultiSheetWorkbook({
        sheets: [
          {
            name: "Taller Principal",
            columns: [
              { header: "Código", key: "codigo", width: 20 },
              { header: "Nombre", key: "nombre", width: 35 },
              { header: "Cantidad", key: "cantidad", width: 14, numFmt: "#,##0" },
            ],
            rows: [
              {
                codigo: "C1",
                nombre: "Producto Uno",
                cantidad: 10,
                columnaExtraIgnorada: "no debe aparecer",
              },
            ],
          },
        ],
      });

      const ws = workbook.getWorksheet("Taller Principal");
      expect(ws).toBeDefined();
      expect(ws!.columns?.length).toBe(3);

      const row1 = ws!.getRow(1);
      expect(row1.getCell(1).value).toBe("Código");
      expect(row1.getCell(2).value).toBe("Nombre");
      expect(row1.getCell(3).value).toBe("Cantidad");
      expect(row1.getCell(4).value).toBeNull();
      expect(row1.getCell(5).value).toBeNull();

      const row2 = ws!.getRow(2);
      expect(row2.getCell(1).value).toBe("C1");
      expect(row2.getCell(2).value).toBe("Producto Uno");
      expect(row2.getCell(3).value).toBe(10);
      expect(row2.getCell(4).value).toBeNull();

      const buffer = await workbook.xlsx.writeBuffer();
      const loadedWb = new ExcelJS.Workbook();
      await loadedWb.xlsx.load(buffer);
      const loadedWs = loadedWb.getWorksheet("Taller Principal");

      expect(loadedWs!.columns?.length).toBe(3);
      expect(loadedWs!.actualColumnCount).toBe(3);
    });
  });

  describe("buildExcelResponse", () => {
    it("retorna un Response con content-type xlsx y content-disposition correcto", async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Test");
      const res = await buildExcelResponse(workbook, "inventario_2026-10-06");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="inventario_2026-10-06.xlsx"'
      );
    });
  });
});
