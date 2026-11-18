"use client";

import React from "react";
import { css } from "@emotion/react";
import { ChevronDown, Trash2 } from "lucide-react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import IconButton from "@/app/components/ui/IconButton";
import { COLOR } from "@/theme/theme";
import NumberInput from "@/app/components/ui/NumberInput";
import { formatArs } from "@/lib/format";
export type OperacionLineaDraft = {
  id?: string;
  stockId: string;
  cantidad: number;
  cantidadEntregar?: number;
  unitario: number;
  total: number;
};

export const OPERACION_LINE_GRID_TEMPLATE =
  "minmax(240px, 1fr) 70px 76px 115px 115px 40px";

type Props = {
  index: number;
  linea: OperacionLineaDraft;
  disabled: boolean;
  stockSelectionDisabled?: boolean;
  loadingStocks: boolean;
  stockOptions: AutocompleteOption[];
  getDefaultUnitarioForStockId?: (stockId: string) => number | null;
  getStockActualForStockId?: (stockId: string) => number | undefined;
  isVenta?: boolean;
  onChange: (next: OperacionLineaDraft) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  mobileExpanded?: boolean;
  onMobileActivate?: () => void;
  onMobileToggle?: () => void;
};

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function OperacionLineaEditor({
  index,
  linea,
  disabled,
  stockSelectionDisabled = false,
  loadingStocks,
  stockOptions,
  getDefaultUnitarioForStockId,
  getStockActualForStockId,
  isVenta = false,
  onChange,
  onRemove,
  canRemove = false,
  mobileExpanded = false,
  onMobileActivate,
  onMobileToggle,
}: Props) {
  const recomputeFromUnit = (next: OperacionLineaDraft) => {
    const cantidad = Number(next.cantidad) || 0;
    const unitario = Number(next.unitario) || 0;
    return { ...next, total: round2(cantidad * unitario) };
  };

  const recomputeFromTotal = (next: OperacionLineaDraft) => {
    const cantidad = Number(next.cantidad) || 0;
    const total = Number(next.total) || 0;
    const unitario = cantidad > 0 ? round2(total / cantidad) : Number(next.unitario) || 0;
    return { ...next, unitario };
  };

  const onStockChange = (stockId: string) => {
    const cantidad = Number(linea.cantidad) || 0;
    const stockFisico = getStockActualForStockId?.(stockId);
    let cantidadEntregar = linea.cantidadEntregar;
    if (isVenta && stockFisico !== undefined) {
      cantidadEntregar = Math.min(cantidad, Math.max(0, stockFisico));
    }
    const base: OperacionLineaDraft = { ...linea, stockId, cantidadEntregar };
    const unitDefault = getDefaultUnitarioForStockId?.(stockId);
    if (typeof unitDefault === "number" && Number.isFinite(unitDefault)) {
      onChange(recomputeFromUnit({ ...base, unitario: unitDefault }));
      return;
    }
    onChange(base);
  };

  const onCantidadChange = (cantidad: number) => {
    const prevCantidad = Number(linea.cantidad) || 0;
    const stockFisico = linea.stockId ? getStockActualForStockId?.(linea.stockId) : undefined;
    const prevEntregar = linea.cantidadEntregar !== undefined ? linea.cantidadEntregar : prevCantidad;
    let cantidadEntregar = prevEntregar;

    if (prevEntregar === prevCantidad) {
      cantidadEntregar = isVenta && stockFisico !== undefined
        ? Math.min(cantidad, Math.max(0, stockFisico))
        : cantidad;
    } else if (isVenta && stockFisico !== undefined && prevCantidad > 0 && prevEntregar === Math.min(prevCantidad, Math.max(0, stockFisico))) {
      cantidadEntregar = Math.min(cantidad, Math.max(0, stockFisico));
    }

    onChange(recomputeFromUnit({ ...linea, cantidad, cantidadEntregar }));
  };

  const onCantidadEntregarChange = (val: number) => {
    const cantidadEntregar = Math.max(0, Math.round(val));
    onChange({ ...linea, cantidadEntregar });
  };

  const onUnitarioChange = (unitario: number) => {
    onChange(recomputeFromUnit({ ...linea, unitario }));
  };

  const onTotalChange = (total: number) => {
    onChange(recomputeFromTotal({ ...linea, total }));
  };

  const cantidad = Number(linea.cantidad) || 0;
  const cantidadEntregar = linea.cantidadEntregar !== undefined ? Number(linea.cantidadEntregar) : cantidad;
  const stockFisico = linea.stockId ? getStockActualForStockId?.(linea.stockId) : undefined;
  const isExceededPactada = cantidadEntregar > cantidad;
  const isExceededStock = isVenta && stockFisico !== undefined && cantidadEntregar > stockFisico;
  const isInvalidEntregar = isExceededPactada || isExceededStock;
  const productLabel = stockOptions.find((option) => option.value === linea.stockId)?.label
    ?? (linea.stockId ? "Producto seleccionado" : "Elegí un producto");

  return (
    <div
      css={[styles.lineRow, mobileExpanded && styles.lineRowExpanded]}
      data-testid={`operaciones-line-${index}`}
    >
      <div css={[styles.mobileHeader, !canRemove && styles.mobileHeaderWithoutRemove]} data-mobile-header="">
        <button
          type="button"
          css={styles.mobileSummaryButton}
          onClick={onMobileToggle}
          aria-expanded={mobileExpanded}
          aria-label={`${mobileExpanded ? "Editando" : "Editar"} ${productLabel}`}
          data-testid={`operaciones-line-${index}-summary`}
        >
          <span css={styles.mobileSummaryTop}>
            <strong css={styles.mobileSummaryProduct}>{productLabel}</strong>
            <span css={styles.mobileSummaryTrailing}>
              <strong css={styles.mobileSummaryTotal}>{formatArs(linea.total)}</strong>
              <ChevronDown
                size={16}
                css={[styles.mobileChevron, mobileExpanded && styles.mobileChevronExpanded]}
                aria-hidden="true"
              />
            </span>
          </span>
          <span css={styles.mobileSummaryDetails}>
            Cantidad: {cantidad} · {isVenta ? "Entregar" : "Recibir"}: {cantidadEntregar}
          </span>
          <span css={styles.mobileSummaryHint}>Unitario: {formatArs(linea.unitario)}</span>
        </button>
      </div>
      <div data-mobile-field="" data-mobile-field-full="" onFocusCapture={onMobileActivate}>
        <span css={styles.mobileFieldLabel}>Producto</span>
        <Autocomplete
          options={stockOptions}
          value={linea.stockId}
          onChange={onStockChange}
          placeholder={loadingStocks ? "Cargando..." : "Buscar item..."}
          disabled={disabled || stockSelectionDisabled || loadingStocks}
          dataTestId={`operaciones-line-${index}-stock`}
          style={styles.autocompleteCompact}
          inputStyle={styles.controlInput}
        />
      </div>

      <div data-mobile-field="" onFocusCapture={onMobileActivate}>
        <span css={styles.mobileFieldLabel}>Cantidad</span>
        <NumberInput
          minValue={0}
          allowDecimals={false}
          disabled={disabled}
          value={linea.cantidad}
          onValueChange={(next) => onCantidadChange(Math.round(next))}
          style={{ ...styles.controlInput, ...styles.qtyInput }}
          data-testid={`operaciones-line-${index}-cantidad`}
          aria-label="Cantidad"
        />
      </div>

      <div data-mobile-field="" onFocusCapture={onMobileActivate}>
        <span css={styles.mobileFieldLabel}>{isVenta ? "Cantidad a entregar" : "Cantidad a recibir"}</span>
        <NumberInput
          minValue={0}
          allowDecimals={false}
          disabled={disabled}
          value={linea.cantidadEntregar !== undefined ? linea.cantidadEntregar : linea.cantidad}
          onValueChange={onCantidadEntregarChange}
          style={{
            ...styles.controlInput,
            ...styles.qtyInput,
            ...(isInvalidEntregar
              ? {
                  border: `1px solid ${COLOR.STATUS.DANGER.BORDER}`,
                  background: COLOR.STATUS.DANGER.BG_SUBTLE,
                  color: COLOR.STATUS.DANGER.TEXT,
                }
              : {}),
          }}
          data-testid={`operaciones-line-${index}-cantidad-entregar`}
          aria-label="Cantidad a entregar o recibir"
          aria-invalid={isInvalidEntregar}
          title={
            isExceededPactada
              ? "La cantidad no puede superar la cantidad pactada"
              : isExceededStock
              ? `No hay stock físico suficiente en taller (${stockFisico} u.) para entregar en este momento.`
              : undefined
          }
        />
      </div>

      <div data-mobile-field="" onFocusCapture={onMobileActivate}>
        <span css={styles.mobileFieldLabel}>Precio unitario</span>
        <NumberInput
          minValue={0}
          allowDecimals
          disabled={disabled}
          value={linea.unitario}
          onValueChange={onUnitarioChange}
          style={{ ...styles.controlInput, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-unitario`}
          aria-label="Unitario"
        />
      </div>

      <div data-mobile-field="" onFocusCapture={onMobileActivate}>
        <span css={styles.mobileFieldLabel}>Total</span>
        <NumberInput
          minValue={0}
          allowDecimals
          disabled={disabled}
          value={linea.total}
          onValueChange={onTotalChange}
          style={{ ...styles.controlInput, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-total`}
          aria-label="Total"
        />
      </div>
      {canRemove ? (
        <div css={styles.removeCell}>
          <IconButton
            icon={<Trash2 />}
            size={16}
            onClick={onRemove}
            title="Eliminar línea"
            data-testid={`operaciones-line-${index}-remove`}
            style={styles.trashBtn}
            ariaLabel="Eliminar línea"
          />
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  controlInput: {
    width: "100%",
    padding: "10px 12px",
    height: 44,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    fontSize: 14,
  } as const,
  qtyInput: {
    textAlign: "right" as const,
    paddingLeft: 8,
    paddingRight: 8,
  } as const,
  moneyInput: {
    textAlign: "right" as const,
  } as const,
  autocompleteCompact: {
    minWidth: 0,
  } as const,
  lineRow: css({
    display: "grid",
    gridTemplateColumns: OPERACION_LINE_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    [`@media (max-width: 720px)`]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 0,
      padding: "12px 0",
      position: "relative",
      borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
      "&:last-child": {
        borderBottom: "none",
      },
      "& > [data-mobile-field]": {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        maxHeight: 0,
        opacity: 0,
        overflow: "hidden",
        visibility: "hidden",
      },
    },
    ["@media (max-width: 720px) and (prefers-reduced-motion: no-preference)"]: {
      "& > [data-mobile-field]": {
        transition: "max-height 240ms ease, opacity 180ms ease, visibility 0s linear 240ms",
      },
    },
  }),
  lineRowExpanded: css({
    ["@media (max-width: 720px)"]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      columnGap: 12,
      rowGap: 12,
      "& > [data-mobile-header]": {
        gridColumn: "1 / -1",
      },
      "& > [data-mobile-field-full]": {
        gridColumn: "1 / -1",
      },
      "& > [data-mobile-field]": {
        maxHeight: 90,
        opacity: 1,
        visibility: "visible",
      },
      "& > [data-mobile-field] > span:first-child": {
        display: "block",
        color: COLOR.TEXT.SECONDARY,
        fontSize: 12,
        fontWeight: 600,
      },
    },
    ["@media (max-width: 720px) and (prefers-reduced-motion: no-preference)"]: {
      "& > [data-mobile-field]": {
        transition: "max-height 240ms ease, opacity 180ms ease, visibility 0s linear 0s",
      },
    },
  }),
  mobileHeader: css({
    display: "none",
    ["@media (max-width: 720px)"]: {
      display: "flex",
      order: -1,
      alignItems: "center",
      gap: 8,
      width: "100%",
      minHeight: 44,
      paddingRight: 52,
      boxSizing: "border-box",
    },
  }),
  mobileHeaderWithoutRemove: css({
    ["@media (max-width: 720px)"]: {
      paddingRight: 0,
    },
  }),
  mobileSummaryButton: css({
    display: "none",
    ["@media (max-width: 720px)"]: {
      display: "flex",
    },
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    padding: 0,
    border: 0,
    background: "transparent",
    color: COLOR.TEXT.PRIMARY,
    textAlign: "left",
    cursor: "pointer",
  }),
  mobileSummaryTop: css({
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  }),
  mobileSummaryTrailing: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
    flexShrink: 0,
  }),
  mobileSummaryProduct: css({
    minWidth: 0,
    overflowWrap: "anywhere",
    fontSize: 14,
    fontWeight: 600,
  }),
  mobileSummaryTotal: css({
    flexShrink: 0,
    fontSize: 14,
    fontWeight: 700,
  }),
  mobileSummaryDetails: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    lineHeight: 1.45,
  }),
  mobileSummaryHint: css({
    color: COLOR.TEXT.TERTIARY,
    fontSize: 11,
  }),
  mobileChevron: css({
    flexShrink: 0,
    color: COLOR.TEXT.SECONDARY,
    ["@media (prefers-reduced-motion: no-preference)"]: {
      transition: "transform 180ms ease",
    },
  }),
  mobileChevronExpanded: css({
    transform: "rotate(180deg)",
  }),
  mobileFieldLabel: css({
    display: "none",
  }),
  removeCell: css({
    display: "contents",
    ["@media (max-width: 720px)"]: {
      display: "flex",
      justifyContent: "flex-end",
      position: "absolute",
      top: 12,
      right: 0,
    },
  }),
  trashBtn: {
    height: 44,
    width: 44,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  } as React.CSSProperties,
} as const;

