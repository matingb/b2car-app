import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

/** Los remitos se listan junto con las facturas en Documentos. */
export default function RemitosPage() {
  redirect(`${ROUTES.facturacion}?tipo=REMITO`);
}
