"use client";

import { css } from "@emotion/react";
import { Calendar, CalendarClock, Pencil, ReceiptText, ShoppingCart, Store, Trash, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import {
  COMPROBANTE_RECIBIDO_TIPO_LABEL,
  formatCuit,
  type ComprobanteRecibido,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";

type Props = {
  comprobante: ComprobanteRecibido;
  canEdit: boolean;
  working: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/** Resumen de una factura o retención recibida, con la misma estructura que el de los comprobantes emitidos. */
export default function ComprobanteRecibidoSummaryCard({ comprobante, canEdit, working, onEdit, onDelete }: Props) {
  const tipoLabel = COMPROBANTE_RECIBIDO_TIPO_LABEL[comprobante.tipoDocumento];
  const esFactura = comprobante.tipoDocumento === "FACTURA";
  const cuit = formatCuit(comprobante.emisor.cuit);

  return (
    <section style={styles.container}>
      <Card style={styles.card}>
        <div css={styles.header}>
          <div style={styles.headerLeft}>
            <SourceHeader comprobante={comprobante} />
            <span style={styles.state}>Recibida</span>
          </div>

          {canEdit ? (
            <div style={styles.headerActions}>
              <IconButton
                icon={<Pencil />}
                size={18}
                onClick={onEdit}
                disabled={working}
                title={`Editar ${tipoLabel.toLowerCase()}`}
                ariaLabel={`Editar ${tipoLabel.toLowerCase()}`}
                hoverColor={COLOR.ACCENT.PRIMARY}
                data-testid="comprobante-recibido-editar"
              />
              <IconButton
                icon={<Trash />}
                size={18}
                onClick={onDelete}
                disabled={working}
                title={`Eliminar ${tipoLabel.toLowerCase()}`}
                ariaLabel={`Eliminar ${tipoLabel.toLowerCase()}`}
                hoverColor={COLOR.SEMANTIC.DANGER}
                data-testid="comprobante-recibido-eliminar"
              />
            </div>
          ) : null}
        </div>

        <div style={styles.body}>
          <div css={styles.grid}>
            <div style={styles.amountBlock}>
              <div>
                <span style={styles.label}>{esFactura ? "Total facturado" : "Total retenido"}</span>
                <strong style={styles.total}>{formatArs(comprobante.total)}</strong>
              </div>
            </div>

            <div style={styles.detailsGrid}>
              <MetaItem
                label="Fecha de comprobante"
                icon={<Calendar size={16} />}
                value={formatCalendarDateLabel(comprobante.fecha, "-")}
              />
              <MetaItem
                label="Fecha de vencimiento"
                icon={<CalendarClock size={16} />}
                value={formatCalendarDateLabel(comprobante.fechaVencimiento, "Sin vencimiento")}
              />
              <Party
                label={tipoLabel}
                icon={<ReceiptText size={14} />}
                name={esFactura ? `${tipoLabel} ${comprobante.clase ?? ""}`.trim() : tipoLabel}
                detail={comprobante.numero ?? "Sin número"}
              />
              <Party
                label="Emisor"
                icon={<Store size={14} />}
                name={comprobante.emisor.razonSocial ?? "-"}
                detail={cuit || "Sin CUIT"}
              />
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function MetaItem({ label, icon, value: content, mono = false }: { label: string; icon: React.ReactNode; value: string; mono?: boolean }) {
  return (
    <Card style={styles.metaItem}>
      <span style={styles.label}>{label}</span>
      <div style={{ ...styles.metaValue, ...(mono ? styles.mono : {}) }}>{icon}{content}</div>
    </Card>
  );
}

function Party({ label, icon, name, detail }: { label: string; icon: React.ReactNode; name: string; detail: string }) {
  return (
    <Card style={styles.metaItem}>
      <span style={styles.labelWithIcon}>{icon}{label}</span>
      <div style={styles.partyValue}><strong>{name}</strong><span>{detail}</span></div>
    </Card>
  );
}

/** Operación de origen (compra o gasto). Abre su detalle. */
function SourceHeader({ comprobante }: { comprobante: ComprobanteRecibido }) {
  const router = useRouter();
  const esGasto = comprobante.operacionTipo === "GASTO";
  const goToSource = () => router.push(ROUTES.operacionDetalle(comprobante.operacionId));

  return (
    <Card
      style={styles.sourceCard}
      title={`Ver detalle de ${esGasto ? "el gasto" : "la compra"}`}
      onClick={goToSource}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToSource();
        }
      }}
      data-testid="comprobante-recibido-origen"
    >
      <div style={styles.sourceName}>
        {esGasto ? <Wallet size={16} color={COLOR.ICON.MUTED} /> : <ShoppingCart size={16} color={COLOR.ICON.MUTED} />}
        <span>{esGasto ? "Gasto" : "Compra"}</span>
      </div>
      <span style={styles.sourceDivider} />
      <strong style={styles.sourceId}>#{comprobante.operacionId.slice(0, 8)}</strong>
    </Card>
  );
}

const styles = {
  container: { marginTop: 16, fontFamily: "var(--font-geist-sans), sans-serif" },
  card: { padding: 0, overflow: "hidden" },
  header: css({
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  }),
  headerLeft: { display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 12 },
  headerActions: { display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 4 },
  sourceCard: { display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer" },
  sourceName: { display: "flex", alignItems: "center", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 14, fontWeight: 500 },
  sourceDivider: { width: 1, height: 16, backgroundColor: COLOR.BORDER.DEFAULT },
  sourceId: { color: COLOR.TEXT.PRIMARY, fontFamily: "monospace", fontSize: 13 },
  state: {
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  body: { padding: 24 },
  grid: css({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 32,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: { gridTemplateColumns: "minmax(220px, 0.8fr) minmax(420px, 1.2fr)" },
  }),
  amountBlock: { display: "flex", flexDirection: "column" as const, gap: 16 },
  label: { fontSize: 10, textTransform: "uppercase" as const, fontWeight: 700, color: COLOR.TEXT.TERTIARY, letterSpacing: "0.05em", marginBottom: 4, display: "block" },
  total: { display: "block", fontSize: 36, fontWeight: 700, color: COLOR.TEXT.PRIMARY, letterSpacing: "-0.025em" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  metaItem: { padding: 12 },
  metaValue: { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: COLOR.TEXT.PRIMARY, marginTop: 4, whiteSpace: "nowrap" as const },
  mono: { fontFamily: "monospace" },
  labelWithIcon: { fontSize: 10, textTransform: "uppercase" as const, fontWeight: 700, color: COLOR.TEXT.TERTIARY, letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 },
  partyValue: { display: "flex", flexDirection: "column" as const, gap: 3, color: COLOR.TEXT.PRIMARY, fontSize: 14, overflow: "hidden" },
} as const;
