import ExcelJS from "exceljs";
import { exportFacturasRows } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantBillingActor } from "@/lib/facturacion/serverAuth";
import { createClient } from "@/supabase/server";
import { FiscalQueryError, parseFiscalFilters } from "@/lib/facturacion/reporteFiscal";
import { facturasReporteService } from "./facturasReporteService";

export const runtime = "nodejs";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  try {
    const actor = await requireTenantBillingActor();
    const params = new URL(request.url).searchParams;
    if (params.has("reporte")) {
      const filters = parseFiscalFilters(params);
      const corte = new Date().toISOString();
      const result = await facturasReporteService.generate(await createClient(), actor.tenantId, filters, corte);
      if (result.error || !result.data) return Response.json({ error: "No se pudo generar el reporte fiscal completo" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
      return new Response(result.data.body, { headers: {
        "Content-Type": result.data.mime,
        "Content-Disposition": `attachment; filename="${result.data.filename}"`,
        "Cache-Control": "private, no-store",
      } });
    }
    const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
    const rows = await exportFacturasRows(actor.tenantId, {
      estado: params.get("estado"), ambiente: params.get("ambiente"),
      documentoTipo: params.get("documentoTipo"), desde: params.get("desde"),
      hasta: params.get("hasta"), search: params.get("search"),
    });
    const filename = `comprobantes-${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") {
      const headers = Object.keys(rows[0] ?? {
        fecha: "", comprobante: "", tipo: "", ambiente: "", estado: "",
        receptor: "", documento: "", total: "", cae: "", origen: "", origenId: "",
      });
      const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escapeCsv(row[key as keyof typeof row])).join(","))].join("\r\n");
      return new Response(`\uFEFF${csv}`, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
      });
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Comprobantes", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Fecha", key: "fecha", width: 13 }, { header: "Comprobante", key: "comprobante", width: 22 },
      { header: "Tipo", key: "tipo", width: 18 }, { header: "Ambiente", key: "ambiente", width: 16 },
      { header: "Estado", key: "estado", width: 15 }, { header: "Receptor", key: "receptor", width: 32 },
      { header: "Documento", key: "documento", width: 18 }, { header: "Total", key: "total", width: 16, style: { numFmt: '$ #,##0.00' } },
      { header: "CAE", key: "cae", width: 20 }, { header: "Origen", key: "origen", width: 13 },
      { header: "ID origen", key: "origenId", width: 38 },
    ];
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    sheet.autoFilter = { from: "A1", to: "K1" };
    const buffer = await workbook.xlsx.writeBuffer();
    const raw = buffer as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
    const body = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof FiscalQueryError) return Response.json({ error: error.message }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
    const response = facturacionErrorResponse(error);
    if (new URL(request.url).searchParams.has("reporte")) response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
