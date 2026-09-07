"use client";

import { css } from "@emotion/react";
import { Calendar, Download, ReceiptText, RefreshCw, ShieldCheck, ShoppingCart, UserRound, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import {
  FACTURA_ESTADO_LABEL,
  comprobanteLabel,
  type FacturaElectronicaDetalle,
} from "@/lib/facturacion/types";

type Props = {
  invoice: FacturaElectronicaDetalle;
  working: boolean;
  canManage: boolean;
  onDownloadPdf: () => void;
  onReconcile: () => void;
};

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-AR").format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "-";
}

function invoiceNumber(invoice: FacturaElectronicaDetalle) {
  return invoice.numeroComprobante
    ? `${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante).padStart(8, "0")}`
    : "Sin número";
}

function stateStyle(state: FacturaElectronicaDetalle["estado"]) {
  if (state === "AUTORIZADA") return styles.authorizedState;
  if (state === "RECHAZADA") return styles.rejectedState;
  if (state === "INCIERTA") return styles.warningState;
  return styles.neutralState;
}

export default function FacturaSummaryCard({ invoice, working, canManage, onDownloadPdf, onReconcile }: Props) {
  const needsReconciliation = canManage && (invoice.estado === "INCIERTA" || invoice.estado === "ENVIANDO");

  return (
    <section style={styles.container}>
      <Card style={styles.card}>
          <div css={styles.header}>
          <div style={styles.headerLeft}>
            <SourceHeader invoice={invoice} />
            <span style={{ ...styles.state, ...stateStyle(invoice.estado) }}>{FACTURA_ESTADO_LABEL[invoice.estado]}</span>
          </div>

          <div style={styles.headerActions}>
            {invoice.pdfDisponible ? (
              <IconButton
                icon={<Download />}
                size={18}
                onClick={onDownloadPdf}
                title="Descargar PDF"
                ariaLabel="Descargar PDF"
                hoverColor={COLOR.SEMANTIC.SUCCESS}
              />
            ) : null}
            {needsReconciliation ? (
              <Button
                text={working ? "Consultando…" : "Reconciliar ARCA"}
                icon={<RefreshCw size={17} />}
                outline
                disabled={working}
                onClick={onReconcile}
                hideTextOnMobile={false}
              />
            ) : null}
          </div>
        </div>

        <div style={styles.body}>
          <div css={styles.grid}>
            <div style={styles.amountBlock}>
              <div>
                <span style={styles.label}>Total facturado</span>
                <strong style={styles.total}>{invoice.total.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</strong>
              </div>
            </div>

            <div style={styles.detailsGrid}>
              <MetaItem label="Fecha de comprobante" icon={<Calendar size={16} />} value={date(invoice.fechaComprobante)} />
              <MetaItem label="CAE" icon={<ShieldCheck size={16} />} value={invoice.cae ?? "Pendiente"} mono />
              <Party label="Factura" icon={<ReceiptText size={14} />} name={comprobanteLabel(invoice.documentoTipo, invoice.claseComprobante)} detail={invoiceNumber(invoice)} />
              <Party label="Receptor" icon={<UserRound size={14} />} name={invoice.receptorNombre} detail={invoice.receptorDocumento ?? "Consumidor final"} />
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function MetaItem({ label, icon, value: content, mono = false }: { label: string; icon: React.ReactNode; value: string; mono?: boolean }) {
  return <div style={styles.metaItem}><span style={styles.label}>{label}</span><div style={{ ...styles.metaValue, ...(mono ? styles.mono : {}) }}>{icon}{content}</div></div>;
}

function Party({ label, icon, name, detail }: { label: string; icon: React.ReactNode; name: string; detail: string }) {
  return <div style={styles.metaItem}><span style={styles.labelWithIcon}>{icon}{label}</span><div style={styles.partyValue}><strong>{name}</strong><span>{detail}</span></div></div>;
}

function SourceHeader({ invoice }: { invoice: FacturaElectronicaDetalle }) {
  const router = useRouter();
  const isArreglo = invoice.origenTipo === "ARREGLO";
  const sourceName = isArreglo ? "Arreglo" : "Operación";
  const goToSource = () => {
    if (isArreglo) router.push(`/arreglos/${invoice.origenId}`);
  };

  return (
    <Card
      style={styles.sourceCard}
      title={isArreglo ? "Ver detalle del arreglo" : `ID operación: ${invoice.origenId}`}
      onClick={isArreglo ? goToSource : undefined}
      role={isArreglo ? "button" : undefined}
      tabIndex={isArreglo ? 0 : undefined}
      onKeyDown={isArreglo ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToSource();
        }
      } : undefined}
    >
      <div style={styles.sourceName}>
        {isArreglo ? <Wrench size={16} color={COLOR.ICON.MUTED} /> : <ShoppingCart size={16} color={COLOR.ICON.MUTED} />}
        <span>{sourceName}</span>
      </div>
      <span style={styles.sourceDivider} />
      <strong style={styles.sourceId}>#{invoice.origenId.slice(0, 8)}</strong>
    </Card>
  );
}

const styles = {
  container: { marginTop: 16, fontFamily: "var(--font-geist-sans), sans-serif" },
  card: { padding: 0, overflow: "hidden", backgroundColor: COLOR.BACKGROUND.SECONDARY },
  header: css({ backgroundColor: COLOR.BACKGROUND.PRIMARY, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, [`@media (min-width: ${BREAKPOINTS.md}px)`]: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } }),
  headerLeft: { display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 12 },
  sourceCard: { display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", backgroundColor: COLOR.BACKGROUND.SECONDARY },
  sourceName: { display: "flex", alignItems: "center", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 14, fontWeight: 500 },
  sourceDivider: { width: 1, height: 16, backgroundColor: COLOR.BORDER.DEFAULT },
  sourceId: { color: COLOR.TEXT.PRIMARY, fontFamily: "monospace", fontSize: 13 },
  state: { borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600 },
  authorizedState: { color: COLOR.SEMANTIC.SUCCESS, backgroundColor: COLOR.BACKGROUND.SUCCESS_TINT },
  rejectedState: { color: COLOR.ICON.DANGER, backgroundColor: COLOR.BACKGROUND.DANGER_TINT },
  warningState: { color: COLOR.SEMANTIC.WARNING, backgroundColor: COLOR.BACKGROUND.WARNING_TINT },
  neutralState: { color: COLOR.TEXT.SECONDARY, backgroundColor: COLOR.BACKGROUND.SUBTLE },
  headerActions: { display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 4 },
  body: { padding: 24 },
  grid: css({ display: "grid", gridTemplateColumns: "1fr", gap: 32, [`@media (min-width: ${BREAKPOINTS.md}px)`]: { gridTemplateColumns: "minmax(220px, 0.8fr) minmax(420px, 1.2fr)" } }),
  amountBlock: { display: "flex", flexDirection: "column" as const, gap: 16 },
  label: { fontSize: 10, textTransform: "uppercase" as const, fontWeight: 700, color: COLOR.TEXT.TERTIARY, letterSpacing: "0.05em", marginBottom: 4, display: "block" },
  total: { display: "block", fontSize: 36, fontWeight: 700, color: COLOR.TEXT.PRIMARY, letterSpacing: "-0.025em" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  metaItem: { backgroundColor: COLOR.BACKGROUND.PRIMARY, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: 12 },
  metaValue: { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: COLOR.TEXT.PRIMARY, marginTop: 4, whiteSpace: "nowrap" as const },
  mono: { fontFamily: "monospace" },
  labelWithIcon: { fontSize: 10, textTransform: "uppercase" as const, fontWeight: 700, color: COLOR.TEXT.TERTIARY, letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 },
  partyValue: { display: "flex", flexDirection: "column" as const, gap: 3, color: COLOR.TEXT.PRIMARY, fontSize: 14, overflow: "hidden" },
} as const;
