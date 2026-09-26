import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default function TalleresLegacyPage(): never {
  redirect(ROUTES.configuracionTaller);
}
