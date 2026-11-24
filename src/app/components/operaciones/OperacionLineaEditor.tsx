"use client";

import React from "react";
import { css } from "@emotion/react";
import { ChevronDown, Trash2 } from "lucide-react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Dropdown from "@/app/components/ui/Dropdown";
import IconButton from "@/app/components/ui/IconButton";
import { COLOR } from "@/theme/theme";
import NumberInput from "@/app/components/ui/NumberInput";
import DiscountInput from "@/app/components/ui/DiscountInput";
import { formatArs } from "@/lib/format";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";

export type OperacionLineaDraft = {
  id?: string;
  stockId: string;
  cantidad: number;
  cantidadEntregar?: number;
  unitario: number;
  subtotal?: number;
  descuento?: number;
  total: number;
  ivaAlicuotaId?: number | null;
};

export const OPERACION_LINE_GRID_TEMPLATE =
  "minmax(200px, 1fr) 68px 74px 105px 115px 105px 40px";
export const OPERACION_LINE_GRID_TEMPLATE_WITH_IVA =
  "minmax(180px, 1fr) 68px 74px 90px 95px 115px 105px 40px";

const IVA_ALICUOTA_OPTIONS = ALICUOTAS_IVA_ARCA.map((rate) => ({
  value: String(rate.id),
  label: rate.label,
}));

type Props = {
  index: number;
  linea: OperacionLineaDraft;
  productCode?: string | null;
  disabled: boolean;
  stockSelectionDisabled?: boolean;
  loadingStocks: boolean;
  stockOptions: AutocompleteOption[];
  getDefaultUnitarioForStockId?: (stockId: string) => number | null;
  getDefaultIvaAlicuotaIdForStockId?: (stockId: string) => number | null;
  getStockActualForStockId?: (stockId: string) => number | undefined;
  isVenta?: boolean;
  showIvaAlicuota?: boolean;
  onChange: (next: OperacionLineaDraft) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  canMobileExpand?: boolean;
  canMobileDelete?: boolean;
  onMobileConfirm?: () => void;
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
  productCode,
  disabled,
  stockSelectionDisabled = false,
  loadingStocks,
  stockOptions,
  getDefaultUnitarioForStockId,
  getDefaultIvaAlicuotaIdForStockId,
  getStockActualForStockId,
  isVenta = false,
  showIvaAlicuota = false,
  onChange,
  onRemove,
  canRemove = false,
  canMobileExpand = true,
  canMobileDelete = true,
  onMobileConfirm,
  mobileExpanded = false,
  onMobileActivate,
  onMobileToggle,
}: Props) {
  const recomputeFromUnit = (next: OperacionLineaDraft) => {
    const cantidad = Number(next.cantidad) || 0;
    const unitario = Number(next.unitario) || 0;
    const subtotal = round2(cantidad * unitario);
    const descuento = Math.min(subtotal, Math.max(0, Number(next.descuento) || 0));
    return { ...next, subtotal, descuento, total: round2(subtotal - descuento) };
  };

  const recomputeFromTotal = (next: OperacionLineaDraft) => {
    const cantidad = Number(next.cantidad) || 0;
    const total = Number(next.total) || 0;
    const descuento = Number(next.descuento) || 0;
    const subtotal = round2(total + descuento);
    const unitario = cantidad > 0 ? round2(subtotal / cantidad) : Number(next.unitario) || 0;
    return { ...next, unitario, subtotal, total };
  };

  const onDescuentoChange = (descuento: number) => {
    const cantidad = Number(linea.cantidad) || 0;
    const unitario = Number(linea.unitario) || 0;
    const subtotal = round2(cantidad * unitario);
    const clampedDescuento = Math.min(subtotal, Math.max(0, Number(descuento) || 0));
    onChange({
      ...linea,
      subtotal,
      descuento: clampedDescuento,
      total: round2(subtotal - clampedDescuento),
    });
  };

  const onStockChange = (stockId: string) => {
    const cantidad = Number(linea.cantidad) || 0;
    const stockFisico = getStockActualForStockId?.(stockId);
    let cantidadEntregar = linea.cantidadEntregar;
    if (isVenta && stockFisico !== undefined) {
      cantidadEntregar = Math.min(cantidad, Math.max(0, stockFisico));
    }
    const base: OperacionLineaDraft = {
      ...linea,
      stockId,
      cantidadEntregar,
      ivaAlicuotaId: stockId ? getDefaultIvaAlicuotaIdForStockId?.(stockId) ?? 5 : null,
    };
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
  const isMissingProductCollapsed = !linea.stockId && !mobileExpanded;
  const productLabel = stockOptions.find((option) => option.value === linea.stockId)?.label
    ?? (linea.stockId ? "Producto seleccionado" : "Elegí un producto");

  return (
    <div
      css={[styles.lineRow, showIvaAlicuota && styles.lineRowWithIva, mobileExpanded && styles.lineRowExpanded]}
      data-testid={`operaciones-line-${index}`}
    >
      <div css={[styles.mobileHeader, !canRemove && styles.mobileHeaderWithoutRemove]} data-mobile-header="">
        {!mobileExpanded ? (
          <button
            type="button"
            css={[
              styles.mobileSummaryButton,
              !canMobileExpand && styles.mobileSummaryButtonBlocked,
            ]}
            onClick={onMobileToggle}
            disabled={disabled || !canMobileExpand}
            aria-expanded={false}
            aria-label={
              isMissingProductCollapsed
                ? "Falta elegir producto. Expandir fila"
                : `Editar ${productLabel}`
            }
            data-testid={`operaciones-line-${index}-summary`}
          >
            <span css={styles.mobileSummaryTop}>
              {isMissingProductCollapsed ? (
                <span css={styles.mobileMissingProductLabel} data-testid={`operaciones-line-${index}-missing-product`}>
                  Falta elegir producto
                </span>
              ) : (
                <span css={styles.mobileSummaryProduct}>
                  <strong css={styles.mobileSummaryProductName}>{productLabel}</strong>
                  {productCode ? <span css={styles.mobileSummaryCode}>Código: {productCode}</span> : null}
                </span>
              )}
              {!isMissingProductCollapsed ? (
                <strong css={styles.mobileSummaryTotal}>{formatArs(linea.total)}</strong>
              ) : null}
            </span>
            {!isMissingProductCollapsed ? (
              <span css={styles.mobileSummaryBottom}>
                <span css={styles.mobileSummaryDetails}>
                  Cantidad: {cantidad} · {isVenta ? "Entregar" : "Recibir"}: {cantidadEntregar}
                </span>
                <span css={styles.mobileSummaryUnitario}>Unitario: {formatArs(linea.unitario)}</span>
              </span>
            ) : null}
            <ChevronDown
              size={16}
              css={styles.mobileChevron}
              aria-hidden="true"
            />
          </button>
        ) : (
          <div css={styles.mobileExpandedHeader} data-testid={`operaciones-line-${index}-expanded-header`}>
            <div css={styles.mobileExpandedHeaderLeft}>
              <span css={styles.mobileSummaryProduct}>
                <strong css={styles.mobileSummaryProductName}>{productLabel}</strong>
                {productCode ? <span css={styles.mobileSummaryCode}>Código: {productCode}</span> : null}
              </span>
            </div>
            <div css={styles.mobileExpandedHeaderRight}>
              {!isMissingProductCollapsed && (
                <strong css={styles.mobileSummaryTotal}>{formatArs(linea.total)}</strong>
              )}
              <button
                type="button"
                css={styles.mobileDeleteTrashButton}
                onClick={onRemove}
                disabled={!canMobileDelete || disabled}
                title="Eliminar producto"
                aria-label="Eliminar producto"
                data-testid={`operaciones-line-${index}-delete`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
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

      <div
        data-mobile-field=""
        {...(showIvaAlicuota ? { "data-mobile-field-third": "" } : {})}
        onFocusCapture={onMobileActivate}
      >
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

      <div
        data-mobile-field=""
        {...(showIvaAlicuota ? { "data-mobile-field-third": "" } : {})}
        onFocusCapture={onMobileActivate}
      >
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

      {showIvaAlicuota ? (
        <div data-mobile-field="" data-mobile-field-third="" onFocusCapture={onMobileActivate}>
          <span css={styles.mobileFieldLabel}>Alícuota IVA</span>
          <Dropdown
            value={String(linea.ivaAlicuotaId ?? getDefaultIvaAlicuotaIdForStockId?.(linea.stockId) ?? 5)}
            onChange={(value) => onChange({ ...linea, ivaAlicuotaId: Number(value) })}
            disabled={disabled}
            ariaLabel={`Alícuota IVA de la línea ${index + 1}`}
            dataTestId={`operaciones-line-${index}-iva-alicuota`}
            options={IVA_ALICUOTA_OPTIONS}
            style={styles.ivaDropdown}
          />
        </div>
      ) : null}

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
        <span css={styles.mobileFieldLabel}>Descuento</span>
        <DiscountInput
          subtotal={round2((Number(linea.cantidad) || 0) * (Number(linea.unitario) || 0))}
          descuento={Number(linea.descuento) || 0}
          onDescuentoChange={onDescuentoChange}
          disabled={disabled}
          dataTestId={`operaciones-line-${index}-descuento`}
          ariaLabel="Descuento"
          compact
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
      {mobileExpanded ? (
        <div css={styles.mobileActions} data-testid={`operaciones-line-${index}-actions`}>
          <button
            type="button"
            css={[styles.mobileActionButton, styles.mobileConfirmButton]}
            onClick={onMobileConfirm}
            disabled={!linea.stockId || disabled}
            data-testid={`operaciones-line-${index}-confirm`}
          >
            Confirmar
          </button>
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
  ivaDropdown: {
    width: "100%",
    height: 44,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
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
  lineRowWithIva: css({
    gridTemplateColumns: OPERACION_LINE_GRID_TEMPLATE_WITH_IVA,
  }),
  lineRowExpanded: css({
    ["@media (max-width: 720px)"]: {
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      columnGap: 10,
      rowGap: 12,
      "& > [data-mobile-header]": {
        gridColumn: "1 / -1",
      },
      "& > [data-mobile-field]": {
        gridColumn: "span 3",
        maxHeight: 90,
        opacity: 1,
        visibility: "visible",
      },
      "& > [data-mobile-field-third]": {
        gridColumn: "span 2",
      },
      "& > [data-mobile-field-full], & > [data-mobile-field][data-mobile-field-full]": {
        gridColumn: "1 / -1",
      },
      "& > [data-mobile-field] > span:first-child": {
        display: "block",
        color: COLOR.TEXT.SECONDARY,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
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
      paddingRight: 0,
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
    alignItems: "stretch",
    flex: 1,
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    width: "100%",
    position: "relative",
    boxSizing: "border-box",
    padding: "0 24px 0 0",
    border: 0,
    background: "transparent",
    color: COLOR.TEXT.PRIMARY,
    textAlign: "left",
    cursor: "pointer",
  }),
  mobileExpandedHeader: css({
    display: "none",
    ["@media (max-width: 720px)"]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      width: "100%",
      boxSizing: "border-box",
    },
  }),
  mobileExpandedHeaderLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flex: 1,
  }),
  mobileExpandedHeaderRight: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  }),
  mobileDeleteTrashButton: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease, transform 0.1s ease",
    "&:hover:not(:disabled)": {
      color: COLOR.STATUS.DANGER.TEXT,
      background: COLOR.STATUS.DANGER.BG_SUBTLE,
    },
    "&:active:not(:disabled)": {
      color: COLOR.STATUS.DANGER.TEXT,
      background: COLOR.STATUS.DANGER.BG_SUBTLE,
      transform: "scale(0.95)",
    },
    "&:disabled": {
      opacity: 0.35,
      cursor: "not-allowed",
    },
  }),
  mobileSummaryButtonBlocked: css({
    cursor: "not-allowed",
    opacity: 0.55,
  }),
  mobileSummaryTop: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  }),
  mobileSummaryBottom: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  }),
  mobileSummaryProduct: css({
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
  }),
  mobileSummaryProductName: css({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 14,
    fontWeight: 600,
  }),
  mobileSummaryCode: css({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLOR.TEXT.TERTIARY,
    fontSize: 11,
  }),
  mobileMissingProductLabel: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontStyle: "italic",
  }),
  mobileSummaryTotal: css({
    flexShrink: 0,
    fontSize: 14,
    fontWeight: 700,
  }),
  mobileSummaryUnitario: css({
    flexShrink: 0,
    color: COLOR.TEXT.TERTIARY,
    fontSize: 11,
    lineHeight: 1.3,
    textAlign: "right",
  }),
  mobileSummaryDetails: css({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    lineHeight: 1.45,
  }),
  mobileChevron: css({
    position: "absolute",
    top: "50%",
    right: 0,
    flexShrink: 0,
    color: COLOR.TEXT.SECONDARY,
    transform: "translateY(-50%)",
    ["@media (prefers-reduced-motion: no-preference)"]: {
      transition: "transform 180ms ease",
    },
  }),
  mobileChevronExpanded: css({
    transform: "translateY(-50%) rotate(180deg)",
  }),
  mobileFieldLabel: css({
    display: "none",
  }),
  removeCell: css({
    display: "contents",
    ["@media (max-width: 720px)"]: {
      display: "none",
    },
  }),
  mobileActions: css({
    display: "none",
    ["@media (max-width: 720px)"]: {
      display: "flex",
      gridColumn: "1 / -1",
      justifyContent: "flex-end",
      gap: 8,
      width: "100%",
      boxSizing: "border-box",
      marginTop: 4,
    },
  }),
  mobileActionButton: css({
    minWidth: 100,
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 8,
    font: "inherit",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
  mobileConfirmButton: css({
    border: "none",
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    "&:hover:not(:disabled)": {
      background: COLOR.ACCENT.HOVER,
    },
  }),
  mobileDeleteButton: css({
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    "&:hover:not(:disabled)": {
      border: `1px solid ${COLOR.BORDER.DEFAULT}`,
      background: COLOR.BACKGROUND.PRIMARY,
      color: COLOR.TEXT.PRIMARY,
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

