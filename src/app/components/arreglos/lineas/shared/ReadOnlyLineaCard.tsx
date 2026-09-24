"use client";

import React, { useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Clock, Package, Pencil, Trash2, Wrench } from "lucide-react";
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
  valorHoraEmpleado,
  icon,
  onEdit,
  onDelete,
  canInteract,
  readOnly = false,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);

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

  // Cálculos de margen
  const rate = valorHoraEmpleado ?? null;
  const laborCost = horasTrabajadas != null && rate != null ? horasTrabajadas * rate : null;
  const margin = laborCost == null ? null : total - laborCost;

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
              <button
                type="button"
                onClick={() => setShowDetail((prev) => !prev)}
                css={readStyles.hoursTag}
                title="Ver precio y costo"
                aria-label="ver detalle de horas"
              >
                <Clock size={12} color={COLOR.TEXT.SECONDARY} />
                <span>
                  Fact: <strong css={readStyles.hoursBold}>{horasFacturadas == null ? "sin dato" : `${horasFacturadas}h`}</strong> · Trab:{" "}
                  <strong css={readStyles.hoursBold}>{horasTrabajadas == null ? "sin dato" : `${horasTrabajadas}h`}</strong>
                </span>
                <ChevronDown
                  size={12}
                  color={COLOR.TEXT.SECONDARY}
                  css={readStyles.chevron(showDetail)}
                />
              </button>
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

      {/* Detalle simple de precio y costo expandible */}
      {showDetail && kind === "servicios" && (
          <div css={readStyles.marginPanel}>
            <div css={readStyles.marginGrid}>
              <Can permission={Permission.ArreglosPreciosView}>
                <div css={readStyles.marginCard}>
                  <span css={readStyles.marginCardLabel}>Precio Facturado</span>
                  <span css={readStyles.marginCardMain}>{formatMoney(total)}</span>
                  <span css={readStyles.marginCardSub}>
                    {horasFacturadas == null
                      ? `Total histórico: ${cantidad} × ${formatMoney(unitario)}`
                      : `${horasFacturadas}h fact. × ${cantidad} × ${formatMoney(unitario)}/h`}
                  </span>
                </div>
              </Can>

              <Can permission={Permission.EmpleadosView}>
                {laborCost == null || margin == null ? (
                  <div css={readStyles.marginCard}>
                    <span css={readStyles.marginCardLabel}>Costo Mano de Obra</span>
                    <span css={readStyles.marginCardMain}>Costo sin registrar</span>
                  </div>
                ) : (
                  <>
                    <div css={readStyles.marginCard}>
                      <span css={readStyles.marginCardLabel}>Costo Mano de Obra</span>
                      <span css={readStyles.marginCardMain}>{formatMoney(laborCost)}</span>
                      <span css={readStyles.marginCardSub}>
                        {horasTrabajadas}h trab. × {formatMoney(rate ?? 0)}/h
                      </span>
                    </div>
                    <Can permission={Permission.ArreglosPreciosView}>
                      <div css={readStyles.marginCard}>
                        <span css={readStyles.marginCardLabel}>Diferencia (Precio - Costo)</span>
                        <span css={readStyles.marginDifference(margin >= 0)}>
                          {margin >= 0 ? "+" : ""}{formatMoney(margin)}
                        </span>
                      </div>
                    </Can>
                  </>
                )}
              </Can>
            </div>
          </div>
        )}
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
    cursor: "pointer",
    transition: "background-color 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.PRIMARY,
    },
  }),
  hoursBold: css({
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
  }),
  chevron: (open: boolean) =>
    css({
      transition: "transform 150ms ease",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
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
  marginPanel: css({
    marginTop: 12,
    paddingTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    width: "100%",
  }),
  marginGrid: css({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12,
    },
  }),
  marginCard: css({
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  marginCardLabel: css({
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
  }),
  marginCardMain: css({
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),
  marginDifference: (positive: boolean) =>
    css({
      fontSize: 14,
      fontWeight: 700,
      color: positive ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.DANGER,
    }),
  marginCardSub: css({
    fontSize: 10,
    color: COLOR.TEXT.SECONDARY,
  }),
} as const;

