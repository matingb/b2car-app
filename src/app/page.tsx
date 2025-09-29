import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default function HomePage() {
  redirect(ROUTES.clientes);
}


