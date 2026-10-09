import ExcelJS from "exceljs";

export interface ExcelColumnDef<T = Record<string, unknown>> {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  value?(row: T): unknown;
}

export interface ExcelSheetDef<T = Record<string, unknown>> {
  name: string;
  columns: ExcelColumnDef<T>[];
  rows: T[];
  freezeHeader?: boolean;
  autoFilter?: boolean;
}

export interface ExcelWorkbookOptions {
  creator?: string;
  sheets: ExcelSheetDef<unknown>[];
}

export function sanitizeSheetName(name: string, index: number, usedNames: Set<string>): string {
  let cleaned = (name || `Hoja ${index + 1}`)
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);

  if (!cleaned) cleaned = `Hoja ${index + 1}`;

  let uniqueName = cleaned;
  let counter = 1;
  while (usedNames.has(uniqueName.toLowerCase())) {
    const suffix = ` (${counter})`;
    uniqueName = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }

  usedNames.add(uniqueName.toLowerCase());
  return uniqueName;
}

export function buildMultiSheetWorkbook(options: ExcelWorkbookOptions): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.creator ?? "B2Car";
  workbook.created = new Date();

  const usedNames = new Set<string>();
  const sheetsToCreate = options.sheets.length > 0 ? options.sheets : [
    {
      name: "Hoja 1",
      columns: [{ header: "Sin datos", key: "vacio", width: 20 }],
      rows: [],
      freezeHeader: true,
      autoFilter: false,
    },
  ];

  sheetsToCreate.forEach((sheetDef, sheetIndex) => {
    const sheetName = sanitizeSheetName(sheetDef.name, sheetIndex, usedNames);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: sheetDef.freezeHeader !== false ? [{ state: "frozen", ySplit: 1 }] : undefined,
    });

    worksheet.columns = sheetDef.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 20,
      style: col.numFmt ? { numFmt: col.numFmt } : undefined,
    }));

    for (const row of sheetDef.rows) {
      const rowData: Record<string, unknown> = {};
      for (const col of sheetDef.columns) {
        rowData[col.key] = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
      }
      worksheet.addRow(rowData);
    }

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;

    sheetDef.columns.forEach((_, colIndex) => {
      const cell = headerRow.getCell(colIndex + 1);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2937" },
      };
      cell.alignment = { vertical: "middle" };
    });

    if (sheetDef.autoFilter !== false && sheetDef.columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheetDef.columns.length },
      };
    }
  });

  return workbook;
}

export async function writeWorkbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  const raw = buffer as unknown as {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
  };
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
}

export async function buildExcelResponse(
  content: ExcelJS.Workbook | ArrayBuffer | Uint8Array,
  filename: string
): Promise<Response> {
  const body =
    content instanceof ExcelJS.Workbook
      ? await writeWorkbookBuffer(content)
      : content;

  const normalizedFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${normalizedFilename}"`,
    },
  });
}
