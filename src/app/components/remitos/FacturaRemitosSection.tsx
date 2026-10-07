"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { useTenant } from "@/app/providers/TenantProvider";
import { remitosClient } from "@/clients/remitosClient";
import { Permission } from "@/lib/permissions";
import type { FacturaRemitos } from "@/lib/remitos/types";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import RemitoListItem from "./RemitoListItem";

type Props = {
  facturaId: string;
};

/** Sección "Remitos" del detalle de una factura autorizada: lista sus remitos y permite generar uno nuevo. */
export default function FacturaRemitosSection({ facturaId }: Props) {
  const router = useRouter();
  const { hasPermission } = useTenant();
  const [data, setData] = useState<FacturaRemitos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await remitosClient.getFacturaRemitos(facturaId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los remitos");
    } finally {
      setLoading(false);
    }
  }, [facturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEmit = hasPermission(Permission.FacturasEdit);
  const quedaDisponible = Boolean(data?.lineas.some((linea) => linea.cantidadDisponible > 0));

  return (
    <section style={styles.section}>
      <Card style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Remitos</h2>
            <p style={styles.muted}>Entregas documentadas para esta factura. Un remito no modifica la factura.</p>
          </div>
          {canEmit ? (
            <Button
              text="Generar remito"
              icon={<Truck size={16} />}
              outline
              hideTextOnMobile={false}
              disabled={loading || !quedaDisponible}
              title={!loading && !quedaDisponible ? "Todas las cantidades facturadas ya fueron remitidas" : undefined}
              onClick={() => router.push(`${ROUTES.remitosNuevo}?facturaId=${facturaId}`)}
              dataTestId="factura-generar-remito"
            />
          ) : null}
        </div>
        {loading ? <ListSkeleton rows={2} /> : null}
        {error ? <div role="alert" style={styles.error}>{error}</div> : null}
        {!loading && data && data.remitos.length === 0 ? (
          <p style={styles.muted}>Esta factura no tiene remitos.</p>
        ) : null}
        {!loading && data?.remitos.length ? (
          <div style={styles.list}>
            {data.remitos.map((remito) => <RemitoListItem key={remito.id} remito={remito} compact />)}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

const styles = {
  section: { marginTop: 24 },
  card: { background: COLOR.BACKGROUND.SECONDARY, display: "flex", flexDirection: "column" as const, gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" as const },
  title: { margin: "0 0 4px", fontSize: 18 },
  muted: { margin: 0, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  list: { display: "flex", flexDirection: "column" as const, gap: 8 },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8 },
} as const;
