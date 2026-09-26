import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default function ConfiguracionIndexPage(): never {
  redirect(ROUTES.configuracionTaller);
}
