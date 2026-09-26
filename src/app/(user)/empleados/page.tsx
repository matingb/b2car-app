import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default function EmpleadosLegacyPage(): never {
  redirect(ROUTES.configuracionEmpleados);
}
