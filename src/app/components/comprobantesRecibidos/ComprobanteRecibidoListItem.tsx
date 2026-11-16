"use client";

import { useRouter } from "next/navigation";
import { Coins, Store } from "lucide-react";
import { COMPROBANTE_RECIBIDO_ICONO_FONDO, ComprobanteRecibidoIcono } from "./comprobanteRecibidoIcono";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import {
  comprobanteRecibidoTitulo,
  formatCuit,
  type ComprobanteRecibidoResumen,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

/** Pantalla de detalle de la factura o retención recibida. */
export function comprobanteRecibidoHref(comprobanteId: string): string {
  return ROUTES.comprobanteRecibidoDetalle(encodeURIComponent(comprobanteId));
}

export const PROCEDENCIA_LABEL = {
  COMPRA: "Recibido · Compra",
  GASTO: "Recibido · Gasto",
} as const;

type Props = {
  comprobante: ComprobanteRecibidoResumen;
};

/** Ítem del listado de Documentos para facturas y retenciones recibidas (carga manual, sin estado ARCA). */
export default function ComprobanteRecibidoListItem({ comprobante }: Props) {
  const router = useRouter();
  const open = () => router.push(comprobanteRecibidoHref(comprobante.id));
  const procedencia = comprobante.operacionTipo ? PROCEDENCIA_LABEL[comprobante.operacionTipo] : "Recibido";
  const cuit = formatCuit(comprobante.emisorCuit);

  return (
    <Card
      style={styles.card}
      onClick={open}
      role="button"
      tabIndex={0}
      title="Ver el documento en su operación"
      data-testid={`documento-recibido-${comprobante.id}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.icon}><ComprobanteRecibidoIcono size={20} /></div>
            <div style={styles.title}>
              <strong>{comprobanteRecibidoTitulo(comprobante)}</strong>
              <span style={styles.procedencia}>{procedencia}</span>
            </div>
          </div>
          <span style={styles.date}>{formatCalendarDateLabel(comprobante.fecha, "-")}</span>
        </div>
        <div style={styles.metaRow}>
          <IconLabel icon={<Coins size={18} color={COLOR.ICON.MUTED} />} label={formatArs(comprobante.total)} style={styles.meta} />
          <IconLabel
            icon={<Store size={16} color={COLOR.ICON.MUTED} />}
            label={`${comprobante.emisorRazonSocial}${cuit ? ` · ${cuit}` : ""}`}
            style={styles.emisor}
          />
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
  icon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: COMPROBANTE_RECIBIDO_ICONO_FONDO,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  title: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, minWidth: 0 },
  procedencia: { fontSize: 12, color: COLOR.TEXT.SECONDARY },
  date: { color: COLOR.TEXT.SECONDARY, fontSize: 13, whiteSpace: "nowrap" as const, flexShrink: 0 },
  metaRow: { display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "center", color: COLOR.TEXT.SECONDARY },
  meta: { color: COLOR.TEXT.SECONDARY, fontSize: 15, fontWeight: 600 },
  emisor: { color: COLOR.TEXT.SECONDARY, fontSize: 14, minWidth: 0 },
} as const;
