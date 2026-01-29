"use client";

import React from "react";
import { css } from "@emotion/react";
import { Trash2 } from "lucide-react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import IconButton from "@/app/components/ui/IconButton";
import { COLOR } from "@/theme/theme";
export type OperacionLineaDraft = {
  id: string;
  productoId: string;
  cantidad: number;
  unitario: number;
  total: number;
};



export const OPERACION_LINE_GRID_TEMPLATE =
  "minmax(290px, 1fr) 78px 140px 140px 44px";

type Props = {
  index: number;
  linea: OperacionLineaDraft;
  disabled: boolean;
  loadingProductos: boolean;
  productoOptions: AutocompleteOption[];
  getDefaultUnitarioForProductoId?: (productoId: string) => number | null;
  onChange: (next: OperacionLineaDraft) => void;
  onRemove?: () => void;
  canRemove?: boolean;
};

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function OperacionLineaEditor({
  index,
  linea,
  disabled,
  loadingProductos,
  productoOptions,
  getDefaultUnitarioForProductoId,
  onChange,
  onRemove,
  canRemove = false,
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

  const onProductoChange = (productoId: string) => {
    const base: OperacionLineaDraft = { ...linea, productoId };
    const unitDefault = getDefaultUnitarioForProductoId?.(productoId);
    if (typeof unitDefault === "number" && Number.isFinite(unitDefault)) {
      onChange(recomputeFromUnit({ ...base, unitario: unitDefault }));
      return;
    }
    onChange(base);
  };

  const onCantidadChange = (cantidad: number) => {
    onChange(recomputeFromUnit({ ...linea, cantidad }));
  };

  const onUnitarioChange = (unitario: number) => {
    onChange(recomputeFromUnit({ ...linea, unitario }));
  };

  const onTotalChange = (total: number) => {
    onChange(recomputeFromTotal({ ...linea, total }));
  };

  return (
    <div css={styles.lineRow} data-testid={`operaciones-line-${index}`}>
      <div>
        <Autocomplete
          options={productoOptions}
          value={linea.productoId}
          onChange={onProductoChange}
          placeholder={loadingProductos ? "Cargando productos..." : "Buscar producto..."}
          disabled={disabled || loadingProductos}
          dataTestId={`operaciones-line-${index}-producto`}
          style={styles.autocompleteCompact}
          inputStyle={styles.controlInput}
        />
      </div>

      <div>
        <input
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          value={linea.cantidad}
          onChange={(e) => onCantidadChange(Number(e.target.value) || 0)}
          style={{ ...styles.controlInput, ...styles.qtyInput }}
          data-testid={`operaciones-line-${index}-cantidad`}
          aria-label="Cantidad"
        />
      </div>

      <div>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={linea.unitario}
          onChange={(e) => onUnitarioChange(Number(e.target.value) || 0)}
          style={{ ...styles.controlInput, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-unitario`}
          aria-label="Unitario"
        />
      </div>

      <div>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={linea.total}
          onChange={(e) => onTotalChange(Number(e.target.value) || 0)}
          style={{ ...styles.controlInput, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-total`}
          aria-label="Total"
        />
      </div>

      {canRemove ? (
        <IconButton
          icon={<Trash2 />}
          size={16}
          onClick={onRemove}
          title="Eliminar línea"
          data-testid={`operaciones-line-${index}-remove`}
          style={styles.trashBtn}
          ariaLabel="Eliminar línea"
        />
      ) : (
        <div />
      )}
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
      gridTemplateColumns: "1fr 1fr",
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

