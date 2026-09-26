import { redirect } from "next/navigation";
import { ROUTES } from "@/routing/routes";

export default async function EmpleadoDetailLegacyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`${ROUTES.configuracionEmpleados}/${id}`);
}
