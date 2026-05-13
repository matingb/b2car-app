"use client";

import React from "react";
import { css } from "@emotion/react";
import { Pencil, Trash2, Package, Wrench } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "../../../ui/Card";
import { itemIconCircleStyle, styles } from "./lineaStyles";
import { formatMoney, renderQtyXUnit } from "./lineaUtils";

type Kind = "servicios" | "repuestos";

type Props = {
  kind: Kind;
  title: string;
  subtitle?: React.ReactNode;
  cantidad: number;
  unitario: number;
  onEdit: () => void;
  onDelete: () => void;
  canInteract: boolean;
};

export default function ReadOnlyLineaCard({
  kind,
  title,
  subtitle,
  cantidad,
  unitario,
  onEdit,
  onDelete,
  canInteract,
}: Props) {
  const total = cantidad * unitario;
  const qtyXUnit = renderQtyXUnit(cantidad, unitario);
  const kindLabel = kind === "servicios" ? "servicio" : "repuesto";

  return (
    <Card css={readStyles.card}>
      <div css={readStyles.icon(kind)}>
        {kind === "servicios" ? (
          <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
        ) : (
          <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
        )}
      </div>

      <div css={readStyles.main}>
        <div css={readStyles.title}>
          {title}
          {subtitle}
        </div>
        <div css={readStyles.desktopSubtitle}>{qtyXUnit}</div>
        <div css={readStyles.mobileMeta}>
          <span css={readStyles.mobileQtyUnit}>{qtyXUnit}</span>
        </div>
      </div>

      <div css={readStyles.side}>
        <div css={readStyles.total}>{formatMoney(total)}</div>

        <div css={readStyles.actions}>
          <button
            type="button"
            css={readStyles.actionBtn}
            aria-label={`editar ${kindLabel}`}
            onClick={onEdit}
            disabled={!canInteract}
          >
            <Pencil size={18} color={COLOR.ICON.MUTED} />
          </button>

          <button
            type="button"
            css={readStyles.actionBtn}
            aria-label={`eliminar ${kindLabel}`}
            onClick={onDelete}
            disabled={!canInteract}
          >
            <Trash2 size={18} color={COLOR.ICON.DANGER} />
          </button>
        </div>
      </div>
    </Card>
  );
}

const readStyles = {
  card: css({
    ...styles.itemCard,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gap: 12,
    },
  }),
  icon: (kind: Kind) =>
    css({
      ...itemIconCircleStyle(kind),
      ...styles.hideItemIconOnSm,
      flexShrink: 0,
    }),
  main: css({
    ...styles.itemMain,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  }),
  title: css({
    ...styles.itemTitle,
  }),
  desktopSubtitle: css({
    ...styles.itemSubTitle,
    minHeight: 36,
    display: "flex",
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  mobileMeta: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 36,
      minWidth: 0,
    },
  }),
  mobileQtyUnit: css({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.2,
  }),
  side: css({
    minWidth: 96,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      minWidth: 88,
      alignSelf: "stretch",
      justifyContent: "space-between",
    },
  }),
  total: css({
    ...styles.itemTotal,
  }),
  actions: css({
    display: "flex",
    gap: 8,
  }),
  actionBtn: css({
    ...styles.actionBtn,
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 0,
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.45,
    },
  }),
} as const;
