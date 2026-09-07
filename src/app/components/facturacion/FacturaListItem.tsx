"use client";

import Color from "color";
import { useRouter } from "next/navigation";
import { BadgeMinus, BadgePlus, Coins, FileText, ReceiptText, UserRound } from "lucide-react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import {
  FACTURA_ESTADO_LABEL,
  comprobanteLabel,
  type FacturaElectronicaEstado,
  type FacturaElectronicaResumen,
} from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";

type Props = {
  invoice: FacturaElectronicaResumen;
};

const documentPresentation = {
  FACTURA: {
    icon: <FileText size={20} />,
    color: COLOR.ACCENT.PRIMARY,
    background: Color(COLOR.ACCENT.PRIMARY).alpha(0.12).toString(),
  },
  NOTA_CREDITO: {
    icon: <BadgeMinus size={20} />,
    color: COLOR.SEMANTIC.DANGER,
    background: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
  },
  NOTA_DEBITO: {
    icon: <BadgePlus size={20} />,
    color: COLOR.SEMANTIC.WARNING,
    background: Color(COLOR.SEMANTIC.WARNING).alpha(0.14).toString(),
  },
} as const;

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR").format(new Date(`${value}T12:00:00`));
}

function voucherNumber(invoice: FacturaElectronicaResumen) {
  if (!invoice.numeroComprobante) return "Sin número";
  return `${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante).padStart(8, "0")}`;
}

function statusStyle(status: FacturaElectronicaEstado): React.CSSProperties {
  const palette = status === "AUTORIZADA"
    ? { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT }
    : status === "RECHAZADA"
      ? { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT }
      : { color: COLOR.TEXT.SECONDARY, background: COLOR.BACKGROUND.SUBTLE };
  return { ...styles.status, ...palette };
}

export default function FacturaListItem({ invoice }: Props) {
  const router = useRouter();
  const presentation = documentPresentation[invoice.documentoTipo];
  const openInvoice = () => router.push(`/facturacion/${invoice.id}`);

  return (
    <Card
      style={styles.card}
      onClick={openInvoice}
      role="button"
      tabIndex={0}
      title="Ver detalle del comprobante"
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openInvoice();
        }
      }}
    >
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={{ ...styles.icon, color: presentation.color, background: presentation.background }}>{presentation.icon}</div>
            <div style={styles.identity}>
              <div style={styles.title}>
                <strong>{comprobanteLabel(invoice.documentoTipo, invoice.claseComprobante)}</strong>
                <span style={statusStyle(invoice.estado)}>{FACTURA_ESTADO_LABEL[invoice.estado]}</span>
              </div>
            </div>
          </div>
          <span style={styles.date}>{formatDate(invoice.fechaComprobante)}</span>
        </div>
        <div style={styles.metaRow}>
          <div style={styles.metaGroup}>
            <IconLabel icon={<ReceiptText size={18} color={COLOR.ICON.MUTED} />} label={voucherNumber(invoice)} style={styles.metaItem} />
            <IconLabel icon={<Coins size={18} color={COLOR.ICON.MUTED} />} label={formatMoney(invoice.total)} style={styles.metaAmount} />
            <IconLabel icon={<UserRound size={16} color={COLOR.ICON.MUTED} />} label={`${invoice.receptorNombre} · ${invoice.receptorDocumento || "Sin documento"}`} style={styles.metaRecipient} />
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  card: { cursor: "pointer" },
  container: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0, width: "100%" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  icon: { width: 44, height: 44, borderRadius: 999, background: COLOR.BACKGROUND.SUBTLE, color: COLOR.ACCENT.PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  identity: { display: "flex", flexDirection: "column" as const, gap: 3, minWidth: 0 },
  title: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  date: { color: COLOR.TEXT.SECONDARY, fontSize: 13, whiteSpace: "nowrap" as const, flexShrink: 0 },
  status: { borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const },
  metaRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  metaGroup: { display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "center", minWidth: 0 },
  metaItem: { color: COLOR.TEXT.SECONDARY, fontSize: 15, fontWeight: 600 },
  metaAmount: { color: COLOR.TEXT.SECONDARY, fontSize: 15, fontWeight: 600 },
  metaRecipient: { color: COLOR.TEXT.SECONDARY, fontSize: 14, minWidth: 0 },
} as const;
