import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

/** La emisión se inicia desde Documentos o desde el detalle del origen, en un modal. */
export default function NuevoRemitoPage() {
  redirect(`${ROUTES.facturacion}?tipo=REMITO`);
}
