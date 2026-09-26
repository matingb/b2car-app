"use client";

import React from "react";
import { css } from "@emotion/react";
import { Check, Loader2, Package, Wrench, X } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { formatArs } from "@/lib/format";
import ReadOnlyLineaCard from "./ReadOnlyLineaCard";
import { itemIconCircleStyle, styles as lineaStyles } from "./lineaStyles";

export type LineaCardShellProps = {
  kind: "servicios" | "repuestos";
  isEditing: boolean;

  // --- Vista no editable (cuando isEditing === false) ---
  readOnlyView?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  cantidad?: number;
  unitario?: number;
  horasFacturadas?: number | null;
  horasTrabajadas?: number | null;
  valorHoraEmpleado?: number | null;
  onEdit?: () => void;
  onDelete?: () => void;
  canInteract?: boolean;
  readOnly?: boolean;

  // --- Vista editable (cuando isEditing === true) ---
  total?: number | string;
  icon?: React.ReactNode;
  submitting?: boolean;
  canConfirm?: boolean;
  canCancel?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmTitle?: string;
  confirmAriaLabel?: string;
  cancelTitle?: string;
  cancelAriaLabel?: string;
  cardId?: string;

  // Slots de contenido editable específico
  children?: React.ReactNode; // Inputs principales (Descripción o Producto + Números)
  selectors?: React.ReactNode; // Selectores inferiores (Categoría, Empleado, Detalle Horas)
  extra?: React.ReactNode;     // Advertencias o hints de stock
};

export default function LineaCardShell({
  kind,
  isEditing,

  // Vista no editable
  readOnlyView,
  title,
  subtitle,
  cantidad = 1,
  unitario = 0,
  horasFacturadas,
  horasTrabajadas,
  valorHoraEmpleado,
  onEdit,
  onDelete,
  canInteract = true,
  readOnly = false,

  // Vista editable
  total = 0,
  icon,
  submitting = false,
  canConfirm = true,
  canCancel = true,
  onConfirm,
  onCancel,
  confirmTitle,
  confirmAriaLabel = kind === "servicios" ? "guardar servicio" : "guardar repuesto",
  cancelTitle = "Cancelar",
  cancelAriaLabel = kind === "servicios" ? "cancelar servicio" : "cancelar repuesto",
  cardId,

  // Slots
  children,
  selectors,
  extra,
}: LineaCardShellProps) {
  // Si no está en edición, renderiza la vista no editable consolidada
  if (!isEditing) {
    if (readOnlyView) {
      return <>{readOnlyView}</>;
    }
    return (
      <ReadOnlyLineaCard
        kind={kind}
        title={title ?? ""}
        subtitle={subtitle}
        cantidad={cantidad}
        unitario={unitario}
        horasFacturadas={kind === "servicios" ? horasFacturadas : undefined}
        horasTrabajadas={kind === "servicios" ? horasTrabajadas : undefined}
        valorHoraEmpleado={kind === "servicios" ? valorHoraEmpleado : undefined}
        icon={icon}
        onEdit={onEdit ?? (() => {})}
        onDelete={onDelete ?? (() => {})}
        canInteract={canInteract}
        readOnly={readOnly}
      />
    );
  }

  const isConfirmEnabled = canConfirm && !submitting;
  const isCancelEnabled = canCancel && !submitting;

  const formattedTotal =
    typeof total === "number"
      ? formatArs(total, { maxDecimals: 2, minDecimals: 0 })
      : total;

  return (
    <Card css={shellStyles.card} id={cardId}>
      <div css={shellStyles.row}>
        {/* Icono temático o personalizado */}
        <div css={shellStyles.leadingIcon(kind)}>
          {icon ?? (kind === "servicios" ? (
            <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
          ) : (
            <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
          ))}
        </div>

        {/* Cuerpo principal */}
        <div css={shellStyles.body}>
          {/* Fila Superior: Contenido editable + Total */}
          <div css={shellStyles.bodyTop}>
            <div css={shellStyles.inputsWrap}>
              {children}
            </div>

            {/* Total unificado con control de permisos */}
            <Can permission={Permission.ArreglosPreciosView}>
              <div css={shellStyles.totalInline}>
                <span css={shellStyles.totalText}>{formattedTotal}</span>
              </div>
            </Can>
          </div>

          {/* Fila Inferior: Selectores y Botones de Confirmar/Cancelar */}
          <div css={shellStyles.bodyBottom}>
            <div css={shellStyles.selectorsWrap}>
              {selectors}
            </div>

            {/* Botones de acción unificados */}
            <div css={shellStyles.actionsWrap}>
              <button
                type="button"
                css={shellStyles.actionBtn("confirm")}
                disabled={!isConfirmEnabled}
                onClick={() => {
                  if (isConfirmEnabled && onConfirm) {
                    void onConfirm();
                  }
                }}
                aria-label={confirmAriaLabel}
                title={confirmTitle ?? (confirmAriaLabel.includes("agregar") ? "Agregar" : "Confirmar cambios")}
              >
                {submitting ? (
                  <Loader2 size={16} css={shellStyles.spin} />
                ) : (
                  <Check size={16} color={COLOR.SEMANTIC.SUCCESS} />
                )}
              </button>

              <button
                type="button"
                css={shellStyles.actionBtn("cancel")}
                disabled={!isCancelEnabled}
                onClick={() => {
                  if (isCancelEnabled && onCancel) {
                    onCancel();
                  }
                }}
                aria-label={cancelAriaLabel}
                title={cancelTitle}
              >
                <X size={16} color={COLOR.ICON.DANGER} />
              </button>
            </div>
          </div>

          {/* Fila Extra: Alertas de stock / notas */}
          {extra ? <div css={shellStyles.extraRow}>{extra}</div> : null}
        </div>
      </div>
    </Card>
  );
}

const shellStyles = {
  card: css({
    padding: 16,
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    position: "relative",
    zIndex: 20,
  }),
  row: css({
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    width: "100%",
  }),
  leadingIcon: (kind: "servicios" | "repuestos") =>
    css({
      ...itemIconCircleStyle(kind),
      ...lineaStyles.hideItemIconOnSm,
      flexShrink: 0,
      marginTop: 1,
    }),
  body: css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  }),
  bodyTop: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  }),
  inputsWrap: css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  }),
  totalInline: css({
    minWidth: 105,
    textAlign: "right",
    paddingLeft: 4,
    flexShrink: 0,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      textAlign: "right",
      width: "100%",
    },
  }),
  totalText: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap",
  }),
  bodyBottom: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  }),
  selectorsWrap: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flex: 1,
  }),
  extraRow: css({
    width: "100%",
  }),
  actionsWrap: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  }),
  actionBtn: (type: "confirm" | "cancel") =>
    css({
      width: 34,
      height: 34,
      borderRadius: 8,
      border: `1px solid ${COLOR.BORDER.SUBTLE}`,
      backgroundColor:
        type === "confirm" ? COLOR.BACKGROUND.SUCCESS_TINT : COLOR.BACKGROUND.DANGER_TINT,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: 0,
      transition: "opacity 120ms ease, transform 120ms ease",
      "&:hover": {
        opacity: 0.85,
      },
      "&:disabled": {
        opacity: 0.4,
        cursor: "not-allowed",
      },
    }),
  spin: css({
    animation: "spin 1s linear infinite",
    "@keyframes spin": {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" },
    },
  }),
} as const;
