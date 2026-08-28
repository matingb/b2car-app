import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default function FacturacionRedirectPage() {
  redirect(ROUTES.configuracion);
}
