"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, FileBox, FileText } from "lucide-react";
import { Skeleton, Theme } from "@radix-ui/themes";
import Card from "@/app/components/ui/Card";
import { FACTURA_ESTADO_LABEL, comprobanteLabel } from "@/lib/facturacion/types";
import type { DocumentoListado } from "@/lib/documentos/types";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

type Props = {
  documentos: DocumentoListado[];
  /** Sin documentos todavía, muestra un ítem de carga en lugar de la lista. */
  cargando?: boolean;
};

type Presentacion = {
  href: string;
  icon: React.ReactNode;
  titulo: string;
  numero: string;
  estado: string | null;
};

function presentacion(documento: DocumentoListado): Presentacion {
  if (documento.tipo === "REMITO") {
    const { remito } = documento;
    return {
      href: `${ROUTES.remitos}/${remito.id}`,
      icon: <FileBox size={16} />,
      titulo: `Remito ${remito.clase}`,
      numero: remito.numeroVisible.slice(2),
      estado: null,
    };
  }
  const { factura } = documento;
  return {
    href: `${ROUTES.facturacion}/${factura.id}`,
    icon: <FileText size={16} />,
    titulo: comprobanteLabel(factura.documentoTipo, factura.claseComprobante),
    numero: factura.numeroComprobante
      ? `${String(factura.puntoVenta).padStart(5, "0")}-${String(factura.numeroComprobante).padStart(8, "0")}`
      : "Sin número",
    estado: FACTURA_ESTADO_LABEL[factura.estado],
  };
}

/**
 * Lista compacta de facturas, notas y remitos. Cada ítem abre el detalle del documento.
 * Los ítems aíslan su hover y su click para poder ubicarse dentro de otra Card clickeable.
 */
export default function DocumentosAsociadosList({ documentos, cargando = false }: Props) {
  const router = useRouter();

  if (cargando && documentos.length === 0) {
    return (
      <Theme>
        <div role="status" aria-label="Cargando documentos asociados" style={styles.skeletonRow}>
          <Skeleton style={{ width: 16, height: 16, borderRadius: 4 }} />
          <Skeleton style={{ width: 180, height: 14 }} />
          <Skeleton style={{ width: 72, height: 12, marginLeft: "auto" }} />
        </div>
      </Theme>
    );
  }

  return (
    <ul style={styles.list}>
      {documentos.map((documento) => {
        const item = presentacion(documento);
        const abrir = () => router.push(item.href);
        return (
          <li key={`${documento.tipo}-${documento.id}`}>
            <Card
              style={styles.row}
              role="link"
              tabIndex={0}
              title={`Ver ${item.titulo} ${item.numero}`}
              data-isolate-hover="true"
              onClick={(event) => {
                event.stopPropagation();
                abrir();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  abrir();
                }
              }}
            >
              <span style={styles.icon}>{item.icon}</span>
              <span style={styles.main}>
                <strong style={styles.titulo}>{item.titulo}</strong>
                <span style={styles.numero}>{item.numero}</span>
                {item.estado ? <span style={styles.estado}>{item.estado}</span> : null}
              </span>
              <span style={styles.fecha}>{formatCalendarDateLabel(documento.fecha, "-")}</span>
              <ChevronRight size={16} color={COLOR.ICON.MUTED} style={{ flexShrink: 0 }} />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

const styles = {
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" as const, gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
  },
  skeletonRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    border: `2px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.PRIMARY,
  },
  icon: { display: "flex", color: COLOR.ACCENT.PRIMARY, flexShrink: 0 },
  main: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, minWidth: 0, flex: 1 },
  titulo: { fontWeight: 600 },
  numero: { color: COLOR.TEXT.SECONDARY, fontVariantNumeric: "tabular-nums" as const },
  estado: {
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  fecha: { color: COLOR.TEXT.SECONDARY, fontSize: 13, whiteSpace: "nowrap" as const, flexShrink: 0 },
} as const;
