"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import RemitoForm from "@/app/components/remitos/RemitoForm";
import { useTenant } from "@/app/providers/TenantProvider";
import { Permission } from "@/lib/permissions";
import { isValidUuid } from "@/lib/uuid";
import { COLOR } from "@/theme/theme";

export default function NuevoRemitoPage() {
  return (
    <Suspense>
      <NuevoRemitoContent />
    </Suspense>
  );
}

function NuevoRemitoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useTenant();
  const facturaParam = searchParams.get("facturaId");
  const facturaId = isValidUuid(facturaParam) ? facturaParam : null;

  return (
    <div>
      <ScreenHeader title="Documentación" breadcrumbs={["Nuevo remito"]} hasBackButton />
      {hasPermission(Permission.FacturasEdit) ? (
        <RemitoForm
          facturaId={facturaId}
          onEmitted={(id) => router.replace(`/remitos/${id}`)}
          onCancel={() => router.back()}
        />
      ) : (
        <div role="alert" style={styles.error}>No tenés permiso para emitir remitos.</div>
      )}
    </div>
  );
}

const styles = {
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginTop: 16 },
} as const;
