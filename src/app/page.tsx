import { redirect } from "next/navigation";
import { routes } from "@/routing/routes";

export default function HomePage() {
  redirect(routes.clientes);
}


