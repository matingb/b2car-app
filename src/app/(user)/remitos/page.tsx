import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

/** Los remitos se listan junto con las facturas en Documentación. */
export default function RemitosPage() {
  redirect(`${ROUTES.facturacion}?tipo=REMITO`);
}
