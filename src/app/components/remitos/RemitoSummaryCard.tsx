"use client";

import { css } from "@emotion/react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Download, Link2, ReceiptText, ShieldCheck, UserRound, Wrench } from "lucide-react";
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
  const router = useRouter();

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
          {remito.arregloId ? (
            <RelatedDocumentCard
              href={`/arreglos/${remito.arregloId}`}
              icon={<Wrench size={18} />}
              label="Arreglo de origen"
              value="Ver arreglo"
              testId="remito-ver-arreglo"
              onNavigate={(href) => router.push(href)}
            />
          ) : null}
          {remito.factura ? (
            <RelatedDocumentCard
              href={`/facturacion/${remito.factura.id}`}
              icon={<ReceiptText size={18} />}
              label="Factura"
              value={`Ver factura · ${remito.factura.label}`}
              testId="remito-ver-factura"
              onNavigate={(href) => router.push(href)}
            />
          ) : (
            <div style={styles.metaItem}>
              <span style={styles.label}>Factura</span>
              <span style={styles.metaValue}>Sin factura asociada</span>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

function RelatedDocumentCard({
  href,
  icon,
  label,
  value,
  testId,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  testId: string;
  onNavigate: (href: string) => void;
}) {
  const navigate = () => onNavigate(href);

  return (
    <Card
      style={styles.relatedCard}
      onClick={navigate}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          navigate();
        }
      }}
      role="link"
      tabIndex={0}
      data-testid={testId}
    >
      <span style={styles.relatedIcon} aria-hidden="true">{icon}</span>
      <span style={styles.relatedContent}>
        <span style={styles.label}>{label}</span>
        <span style={styles.relatedValue}>{value}</span>
      </span>
      <ChevronRight size={18} color={COLOR.ICON.MUTED} aria-hidden="true" />
    </Card>
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
  relatedCard: { display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", minWidth: 0, cursor: "pointer" },
  relatedIcon: {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    color: COLOR.ICON.MUTED,
    background: COLOR.BACKGROUND.PRIMARY,
    borderRadius: 8,
  },
  relatedContent: { display: "flex", flexDirection: "column" as const, flex: 1, minWidth: 0 },
  relatedValue: { color: COLOR.ACCENT.PRIMARY, fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" as const },
} as const;
