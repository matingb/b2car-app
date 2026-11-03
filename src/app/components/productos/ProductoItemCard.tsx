"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Producto } from "@/app/providers/ProductosProvider";
import { formatArs } from "@/lib/format";
import { getProductoStockBreakdown } from "@/lib/stock";
import { Package, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { css } from "@emotion/react";

type Props = {
  producto: Producto;
  tallerId?: string;
  showStockTitles?: boolean;
  onClick: () => void;
};

export default function ProductoItemCard({
  producto,
  tallerId = "",
  showStockTitles,
  onClick,
}: Props) {
  const stockCounts = useMemo(
    () => getProductoStockBreakdown(producto, tallerId),
    [producto, tallerId]
  );

  const categorias = producto.categorias ?? [];
  const categoriaText = categorias.join(", ");

  return (
    <Card
      onClick={onClick}
      style={styles.card}
      data-testid={`producto-item-${producto.id}`}
    >
      <div style={styles.topSection}>
        <div style={styles.mainInfo}>
          <div style={styles.title} title={producto.nombre}>
            {producto.nombre}
          </div>
          <div style={styles.subtitle}>
            <span style={styles.codigo}>{producto.codigo}</span>
            {categoriaText ? (
              <span css={styles.categoriaWrapper}>
                <span style={styles.dot}> · </span>
                <span style={styles.categoria} title={categoriaText}>
                  {categoriaText}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div style={styles.priceSection}>
          <div style={styles.precio}>
            {formatArs(producto.precioUnitario, { maxDecimals: 0, minDecimals: 0 })}
          </div>
          <div style={styles.costo}>
            Costo {formatArs(producto.costoUnitario, { maxDecimals: 0, minDecimals: 0 })}
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.bottomSection}>
        <div style={styles.pillsContainer}>
          <Badge
            variant="outline"
            color="neutral"
            icon={<Package size={14} color={COLOR.TEXT.SECONDARY} />}
            title="Físico"
            value={stockCounts.fisico}
            valueStyle={styles.pillValueFisico}
            hideTitleOn="tablet"
            showTitle={showStockTitles}
            style={styles.pill}
            dataTestId="stock-pill-fisico"
          />

          <Badge
            variant="outline"
            color="neutral"
            icon={<CheckCircle2 size={14} color={COLOR.STATUS.SUCCESS.TEXT} />}
            title="Disponible"
            value={stockCounts.disponible}
            valueStyle={styles.pillValueDisponible}
            hideTitleOn="tablet"
            showTitle={showStockTitles}
            style={styles.pill}
            dataTestId="stock-pill-disponible"
          />

          <Badge
            variant="outline"
            color="neutral"
            icon={<Clock size={14} color={COLOR.STATUS.INFO.TEXT} />}
            title="Reservado"
            value={stockCounts.reservado}
            valueStyle={styles.pillValueReservado}
            hideTitleOn="tablet"
            showTitle={showStockTitles}
            style={styles.pill}
            dataTestId="stock-pill-reservado"
          />

          <Badge
            variant="outline"
            color="neutral"
            icon={<AlertCircle size={14} color={COLOR.STATUS.DANGER.TEXT} />}
            title="Pendiente"
            value={stockCounts.pendiente}
            valueStyle={styles.pillValuePendiente}
            hideTitleOn="tablet"
            showTitle={showStockTitles}
            style={styles.pill}
            dataTestId="stock-pill-pendiente"
          />
        </div>
      </div>
    </Card>
  );
}

const styles = {
  card: {
    padding: 0,
    overflow: "hidden",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  },
  topSection: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  mainInfo: {
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  subtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  codigo: {
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  },
  dot: {
    color: COLOR.TEXT.SECONDARY,
    margin: "0 2px",
  },
  categoria: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 400,
  },
  categoriaWrapper: css({
    display: "inline",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  priceSection: {
    padding: "12px 18px",
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    minWidth: 110,
  },
  precio: {
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
    lineHeight: 1.2,
  },
  costo: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    marginTop: 2,
    lineHeight: 1.2,
  },
  divider: {
    height: 1,
    backgroundColor: COLOR.BORDER.SUBTLE,
    width: "100%",
  },
  bottomSection: {
    padding: "6px 12px",
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
  pillsContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: 8,
  },
  pill: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.SECONDARY,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 400,
  },
  pillValueFisico: {
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  },
  pillValueDisponible: {
    fontWeight: 700,
    color: COLOR.STATUS.SUCCESS.TEXT,
  },
  pillValueReservado: {
    fontWeight: 700,
    color: COLOR.STATUS.INFO.TEXT,
  },
  pillValuePendiente: {
    fontWeight: 700,
    color: COLOR.STATUS.DANGER.TEXT,
  },
} as const;
