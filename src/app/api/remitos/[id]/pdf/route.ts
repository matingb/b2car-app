import { Permission } from "@/lib/permissions";
import { buildRemitoPdf } from "@/lib/remitos/remitosService";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, uuidParams } from "../../../apiInput";

export const runtime = "nodejs";

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_") || "remito.pdf";
}

export const GET = createApiHandler(
  {
    route: "GET /api/remitos/[id]/pdf",
    fallback: "No se pudo generar el PDF del remito",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const pdf = await buildRemitoPdf(ctx.supabase, ctx.actor.tenantId, id);
    return new Response(Uint8Array.from(pdf.bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(pdf.filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
