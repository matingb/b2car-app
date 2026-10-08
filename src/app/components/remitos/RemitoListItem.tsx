"use client";

import Color from "color";
import { useRouter } from "next/navigation";
import { ReceiptText, Truck, UserRound } from "lucide-react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import type { RemitoResumen } from "@/lib/remitos/types";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { COLOR } from "@/theme/theme";

type Props = {
  remito: RemitoResumen;
  /** Variante compacta para listas embebidas (por ejemplo, en el detalle de una factura). */
  compact?: boolean;
};

export const REMITO_CLASE_COLOR = {
  R: COLOR.ACCENT.PRIMARY,
  X: COLOR.SEMANTIC.WARNING,
} as const;

export function RemitoClaseBadge({ clase, size = 44 }: { clase: RemitoResumen["clase"]; size?: number }) {
  const color = REMITO_CLASE_COLOR[clase];
  return (
    <div
      aria-label={`Remito ${clase}`}
      style={{
        ...styles.badge,
        width: size,
        height: size,
        fontSize: size * 0.45,
        color,
        background: Color(color).alpha(0.12).toString(),
      }}
    >
      {clase}
    </div>
  );
}

export default function RemitoListItem({ remito, compact = false }: Props) {
  const router = useRouter();
  const openRemito = () => router.push(`/remitos/${remito.id}`);

  return (
    <Card
      style={styles.card}
      onClick={openRemito}
      role="button"
      tabIndex={0}
      title="Ver detalle del remito"
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRemito();
        }
      }}
    >
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <RemitoClaseBadge clase={remito.clase} size={compact ? 34 : 44} />
            <div style={styles.identity}>
              <strong style={compact ? styles.compactTitle : undefined}>Remito {remito.clase}</strong>
              <span style={styles.number}>{remito.numeroVisible}</span>
            </div>
          </div>
          <span style={styles.date}>{formatCalendarDateLabel(remito.fechaEmision, "-")}</span>
        </div>
        {compact ? null : (
          <div style={styles.metaRow}>
            <IconLabel
              icon={<UserRound size={16} color={COLOR.ICON.MUTED} />}
              label={`${remito.destinatarioNombre} · ${remito.destinatarioDocumento ?? "Sin documento"}`}
              style={styles.metaRecipient}
            />
            <span style={remito.factura ? styles.facturaChip : styles.sinFacturaChip}>
              {remito.factura ? <ReceiptText size={14} /> : <Truck size={14} />}
              {remito.factura ? remito.factura.label : "Sin factura"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

const styles = {
  card: { cursor: "pointer" },
  container: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0, width: "100%" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  badge: {
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    flex: "0 0 auto",
  },
  identity: { display: "flex", flexDirection: "column" as const, gap: 2, minWidth: 0 },
  compactTitle: { fontSize: 14 },
  number: { color: COLOR.TEXT.SECONDARY, fontSize: 14, fontWeight: 600, fontFamily: "monospace" },
  date: { color: COLOR.TEXT.SECONDARY, fontSize: 13, whiteSpace: "nowrap" as const, flexShrink: 0 },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  metaRecipient: { color: COLOR.TEXT.SECONDARY, fontSize: 14, minWidth: 0 },
  facturaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  sinFacturaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.SUBTLE,
  },
} as const;
