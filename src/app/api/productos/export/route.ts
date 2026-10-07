import { createClient } from "@/supabase/server";
import { requirePermission } from "@/lib/requirePermission";
import { Permission } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { productosExportService } from "./productosExportService";
import { buildExcelResponse } from "@/lib/excel/excelExportBuilder";

export const runtime = "nodejs";

export async function GET() {
  const authError = await requirePermission(Permission.ProductosView);
  if (authError) return authError;

  const supabase = await createClient();

  try {
    const { data, error } = await productosExportService.exportInventarioExcel(supabase);

    if (error || !data) {
      return Response.json(
        { error: error || "Error al generar exportación" },
        { status: 500 }
      );
    }

    return await buildExcelResponse(data.buffer, data.filename);
  } catch (error) {
    logger.error("Error inesperado en GET /api/productos/export:", error);
    return Response.json(
      { error: "Error interno al generar exportación" },
      { status: 500 }
    );
  }
}
