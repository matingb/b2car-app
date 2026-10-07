import { Permission } from "@/lib/permissions";
import { asociarFactura } from "@/lib/remitos/remitosService";
import { parseAsociarFacturaInput } from "@/lib/remitos/remitoValidation";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, readJsonBody, uuidParams } from "../../../apiInput";

export const POST = createApiHandler(
  {
    route: "POST /api/remitos/[id]/factura",
    fallback: "No se pudo asociar el remito a la factura",
    permission: Permission.FacturasEdit,
  },
  async (ctx) => {
    const { id: remitoId } = parseInput(uuidParams("id"), ctx.params);
    const input = parseInput(parseAsociarFacturaInput, await readJsonBody(ctx.req));
    const id = await asociarFactura(ctx.supabase, remitoId, input);
    return Response.json({ data: { id }, error: null });
  },
);
