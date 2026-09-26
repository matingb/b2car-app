"use client";

import React from "react";
import { css } from "@emotion/react";
import { Clock, Package, Pencil, Trash2, Wrench } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "../../../ui/Card";
import { itemIconCircleStyle, styles } from "./lineaStyles";
import { formatMoney, renderQtyXUnit } from "./lineaUtils";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { calcLineTotal } from "@/lib/calcLineTotal";

type Kind = "servicios" | "repuestos";

type Props = {
  kind: Kind;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  cantidad: number;
  unitario: number;
  horasFacturadas?: number | null;
  horasTrabajadas?: number | null;
  valorHoraEmpleado?: number | null;
  icon?: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  canInteract: boolean;
  readOnly?: boolean;
};

export default function ReadOnlyLineaCard({
  kind,
  title,
  subtitle,
  cantidad,
  unitario,
  horasFacturadas,
  horasTrabajadas,
  icon,
  onEdit,
  onDelete,
  canInteract,
  readOnly = false,
}: Props) {
  const total = kind === "servicios"
    ? calcLineTotal({
      cantidad,
      horas_facturadas: horasFacturadas,
      precio_hora_facturada: unitario,
    })
    : cantidad * unitario;

  const qtyXUnit = kind === "servicios" && horasFacturadas != null
    ? `${horasFacturadas}h × ${cantidad} × ${formatMoney(unitario)}`
    : renderQtyXUnit(cantidad, unitario);

  const kindLabel = kind === "servicios" ? "servicio" : "repuesto";

  return (
    <Card css={readStyles.card}>
      <div css={readStyles.topRow}>
        <div css={readStyles.icon(kind)}>
          {icon ?? (kind === "servicios" ? (
            <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
          ) : (
            <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
          ))}
        </div>

        <div css={readStyles.main}>
          <div css={readStyles.title}>{title}</div>
          <div css={readStyles.subtitleRow}>
            {subtitle}
            <span css={readStyles.qtyXUnit}>
              <Can
                permission={Permission.ArreglosPreciosView}
                fallback={kind === "servicios" && horasFacturadas != null
                  ? <>Horas facturadas: {horasFacturadas}; cantidad: {cantidad}</>
                  : <>Cantidad: {cantidad}</>}
              >
                {qtyXUnit}
              </Can>
            </span>

            {/* Tag de Horas Facturadas vs Horas Trabajadas */}
            {kind === "servicios" && (
              <span
                css={readStyles.hoursTag}
                title="Horas facturadas y trabajadas"
              >
                <Clock size={12} color={COLOR.TEXT.SECONDARY} />
                <span>
                  Fact: <strong css={readStyles.hoursBold}>{horasFacturadas == null ? "sin dato" : `${horasFacturadas}h`}</strong> · Trab:{" "}
                  <strong css={readStyles.hoursBold}>{horasTrabajadas == null ? "sin dato" : `${horasTrabajadas}h`}</strong>
                </span>
              </span>
            )}
          </div>
        </div>

        <div css={readStyles.side}>
          <Can permission={Permission.ArreglosPreciosView}>
            <div css={readStyles.total}>{formatMoney(total)}</div>
          </Can>

          {!readOnly ? (
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
          ) : null}
        </div>
      </div>
    </Card>
  );
}

const readStyles = {
  card: css({
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflow: "hidden",
  }),
  topRow: css({
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
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
    justifyContent: "center",
    gap: 4,
    height: "100%",
  }),
  title: css({
    ...styles.itemTitle,
  }),
  subtitleRow: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  }),
  qtyXUnit: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
  }),
  hoursTag: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 500,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
  }),
  hoursBold: css({
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
  }),
  side: css({
    minWidth: 105,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      minWidth: 105,
      alignSelf: "stretch",
      justifyContent: "space-between",
    },
  }),
  total: css({
    ...styles.itemTotal,
    minWidth: 105,
    textAlign: "right",
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

