"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import NumberInput from "@/app/components/ui/NumberInput";

type Props = {
  searchSlot: React.ReactNode;
  cantidad: string;
  precioCompra?: string;
  precioVenta: string;
  showPurchaseUnit?: boolean;
  canInteract: boolean;
  onCantidadChange: (val: string) => void;
  onPrecioCompraChange?: (val: string) => void;
  onPrecioVentaChange: (val: string) => void;
};

export default function RepuestoEditableFields({
  searchSlot,
  cantidad,
  precioCompra = "",
  precioVenta,
  showPurchaseUnit = false,
  canInteract,
  onCantidadChange,
  onPrecioCompraChange,
  onPrecioVentaChange,
}: Props) {
  return (
    <div css={styles.container}>
      {/* Slot de búsqueda / campos de producto */}
      <div css={styles.searchWrap}>{searchSlot}</div>

      {/* Fila de campos numéricos unificados con el mismo diseño */}
      <div css={styles.numRow}>
        {/* Campo Cantidad */}
        <div css={styles.numField("64px")}>
          <span css={styles.prefixLabel}>Cant</span>
          <NumberInput
            id="repuesto-quantity-input"
            aria-label="Cantidad"
            minValue={1}
            allowDecimals={false}
            value={Number(cantidad) || 1}
            onValueChange={(val) => onCantidadChange(String(val))}
            placeholder="1"
            disabled={!canInteract}
            style={styles.fieldNumberInput(canInteract)}
          />
        </div>

        {/* Campo Precio Compra (si aplica) */}
        {showPurchaseUnit && (
          <div css={styles.numField("92px")}>
            <span css={styles.prefixLabel}>$ C</span>
            <NumberInput
              id="repuesto-purchase-price-input"
              aria-label="Precio compra"
              minValue={0}
              allowDecimals
              step="0.01"
              value={Number(precioCompra) || 0}
              onValueChange={(val) => onPrecioCompraChange?.(String(val))}
              placeholder="0.00"
              disabled={!canInteract}
              style={styles.fieldNumberInput(canInteract)}
            />
          </div>
        )}

        {/* Campo Precio Venta */}
        <Can permission={Permission.ArreglosPreciosEdit}>
          <div css={styles.numField("92px")}>
            <span css={styles.prefixLabel}>$</span>
            <NumberInput
              id="repuesto-unit-price-input"
              aria-label="Precio venta"
              minValue={0}
              allowDecimals
              step="0.01"
              max={9999999999.99}
              value={Number(precioVenta) || 0}
              onValueChange={(val) => onPrecioVentaChange(String(val))}
              placeholder="0.00"
              disabled={!canInteract}
              style={styles.fieldNumberInput(canInteract)}
            />
          </div>
        </Can>
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    minWidth: 0,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  }),
  searchWrap: css({
    flex: 1,
    minWidth: 0,
  }),
  numRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "space-between",
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      flexWrap: "nowrap",
      justifyContent: "flex-end",
    },
  }),
  numField: (width: string) =>
    css({
      position: "relative",
      flex: 1,
      minWidth: 64,
      [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
        flex: "none",
        width,
      },
    }),
  prefixLabel: css({
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    pointerEvents: "none",
  }),
  fieldNumberInput: (canInteract: boolean) => ({
    width: "100%",
    height: 38,
    paddingLeft: 30,
    paddingRight: 8,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: canInteract ? "#ffffff" : COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "right" as const,
    boxSizing: "border-box" as const,
    outline: "none",
    cursor: canInteract ? "text" : "not-allowed",
  }),
  numInput: css({
    width: "100%",
    height: 38,
    paddingLeft: 30,
    paddingRight: 8,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: "#ffffff",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "right",
    outline: "none",
    boxSizing: "border-box",
    "&:focus": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
    "&:disabled": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      cursor: "not-allowed",
    },
  }),
} as const;
