import Color from "color";
import { FileText } from "lucide-react";
import { COLOR } from "@/theme/theme";

/**
 * Los documentos recibidos usan el mismo ícono que las facturas emitidas (`FacturaListItem`), en rojo:
 * son comprobantes de egreso (compras y gastos).
 */
export const COMPROBANTE_RECIBIDO_ICONO_COLOR = COLOR.SEMANTIC.DANGER;
export const COMPROBANTE_RECIBIDO_ICONO_FONDO = Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString();

export function ComprobanteRecibidoIcono({ size = 18 }: { size?: number }) {
  return <FileText size={size} color={COMPROBANTE_RECIBIDO_ICONO_COLOR} aria-hidden="true" />;
}
