import React from "react";
import { Trash } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

function itemIconCircleStyle(
  variant: "servicios" | "repuestos"
): React.CSSProperties {
  return {
    ...styles.itemIconCircleBase,
    // A bit more contrast than the card background
    background:
      variant === "repuestos"
        ? COLOR.BACKGROUND.SUCCESS_TINT
        : COLOR.BACKGROUND.INFO_TINT,
  };
}

type Props = {
  emptyText: string;
  items: ArregloDetalleLineaSectionItem[];
  itemIcon: React.ReactNode;
  variant: "servicios" | "repuestos";
};

export default function ArregloDetalleLineasList({
  emptyText,
  items,
  itemIcon,
  variant,
}: Props) {

  const formatMoney = (n: number) =>
    formatArs(n, { maxDecimals: 0, minDecimals: 0 });
  
  const renderQtyXUnit = (cantidad: number, unitario: number) =>
    `${cantidad} x ${formatMoney(unitario)}`;

  return (
    <div style={styles.list}>
      {items.length === 0 ? (
        <div style={styles.emptyState}>{emptyText}</div>
      ) : (
        items.map((item) => (
          <div key={item.id} style={styles.itemCard}>
            <div style={itemIconCircleStyle(variant)}>{itemIcon}</div>

            <div style={styles.itemMain}>
              <div style={styles.itemTitle}>{item.title}</div>
              <div style={styles.itemSubTitle}>{renderQtyXUnit(item.cantidad, item.unitario)}</div>
            </div>

            {item.code ? <div style={styles.codePill}>{item.code}</div> : null}

            <div style={styles.itemTotal}>{formatArs(item.total)}</div>

            <button
              type="button"
              style={styles.deleteBtn}
              aria-label={item.deleteAriaLabel}
              onClick={item.onDelete}
            >
              <Trash size={18} color={COLOR.ICON.DANGER} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export type ArregloDetalleLineaSectionItem = {
  id: string;
  title: string;
  code?: string | null; 
  cantidad: number;
  unitario: number;
  total: number;
  deleteAriaLabel: string;
  onDelete: () => void;
};

const styles = {
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  emptyState: {
    padding: 12,
    borderRadius: 12,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  itemCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  itemIconCircleBase: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  itemSubTitle: {
    marginTop: 6,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  codePill: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    background: COLOR.BACKGROUND.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    marginLeft: 8,
  },
  deleteBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
  },
} as const;