"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { Calendar, Download, Link2, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { REMITO_LEYENDA, type RemitoDetalle } from "@/lib/remitos/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { RemitoClaseBadge } from "./RemitoListItem";

type Props = {
  remito: RemitoDetalle;
  canManage: boolean;
  onDownloadPdf: () => void;
  onAsociar: () => void;
};

export default function RemitoSummaryCard({ remito, canManage, onDownloadPdf, onAsociar }: Props) {
  return (
    <section style={styles.container}>
      <Card style={styles.card}>
        <div css={styles.header}>
          <div style={styles.headerLeft}>
            <RemitoClaseBadge clase={remito.clase} size={52} />
            <div style={styles.title}>
              <strong style={styles.remitoLabel}>REMITO {remito.clase}</strong>
              <span style={styles.leyenda}>{REMITO_LEYENDA}</span>
            </div>
            {remito.ambiente === "HOMOLOGACION" ? <span style={styles.ambiente}>Homologación</span> : null}
          </div>
          <div style={styles.headerActions}>
            <IconButton
              icon={<Download />}
              size={18}
              onClick={onDownloadPdf}
              title="Descargar PDF"
              ariaLabel="Descargar PDF"
              hoverColor={COLOR.SEMANTIC.SUCCESS}
            />
            {canManage && !remito.factura ? (
              <Button
                text="Asociar a factura"
                icon={<Link2 size={16} />}
                outline
                onClick={onAsociar}
                hideTextOnMobile={false}
                dataTestId="remito-asociar-factura"
              />
            ) : null}
          </div>
        </div>
        <div css={styles.grid}>
          <MetaItem label="Número" icon={<ReceiptText size={16} />} value={remito.numeroVisible} mono />
          <MetaItem label="Fecha de emisión" icon={<Calendar size={16} />} value={formatCalendarDateLabel(remito.fechaEmision, "-")} />
          <MetaItem
            label="Destinatario"
            icon={<UserRound size={16} />}
            value={`${remito.destinatarioNombre} · ${remito.destinatarioDocumento ?? "Sin documento"}`}
          />
          {remito.clase === "R" ? (
            <MetaItem label="CAI" icon={<ShieldCheck size={16} />} value={remito.cai ?? "-"} mono />
          ) : null}
          <div style={styles.metaItem}>
            <span style={styles.label}>Factura</span>
            {remito.factura ? (
              <Link href={`/facturacion/${remito.factura.id}`} style={styles.link} data-testid="remito-ver-factura">
                Ver factura · {remito.factura.label}
              </Link>
            ) : (
              <span style={styles.metaValue}>Sin factura asociada</span>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

function MetaItem({ label, icon, value, mono = false }: { label: string; icon: React.ReactNode; value: string; mono?: boolean }) {
  return (
    <div style={styles.metaItem}>
      <span style={styles.label}>{label}</span>
      <div style={{ ...styles.metaValue, ...(mono ? styles.mono : {}) }}>{icon}{value}</div>
    </div>
  );
}

const styles = {
  container: { marginTop: 16 },
  card: { padding: 0, overflow: "hidden", backgroundColor: COLOR.BACKGROUND.SECONDARY },
  header: css({
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "18px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  }),
  headerLeft: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" as const },
  title: { display: "flex", flexDirection: "column" as const, gap: 2 },
  remitoLabel: { fontSize: 22, letterSpacing: "0.02em", color: COLOR.TEXT.PRIMARY },
  leyenda: { fontSize: 11, fontWeight: 700, color: COLOR.TEXT.SECONDARY, letterSpacing: "0.04em" },
  ambiente: {
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.WARNING,
    background: COLOR.BACKGROUND.WARNING_TINT,
  },
  headerActions: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const },
  grid: css({
    padding: 24,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  }),
  metaItem: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 12,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  },
  metaValue: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    marginTop: 4,
    overflowWrap: "anywhere" as const,
  },
  mono: { fontFamily: "monospace" },
  link: { color: COLOR.ACCENT.PRIMARY, fontWeight: 600, fontSize: 14 },
} as const;
