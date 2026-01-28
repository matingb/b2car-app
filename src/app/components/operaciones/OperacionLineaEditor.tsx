"use client";

import React from "react";
import { css } from "@emotion/react";
import { Trash2 } from "lucide-react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { COLOR } from "@/theme/theme";

export type OperacionLineaDraft = {
  id: string;
  productoId: string;
  cantidad: number;
  unitario: number;
  total: number;
};

export type OperacionLineaTipo = "compra" | "venta" | null;

type Props = {
  index: number;
  tipo: OperacionLineaTipo;
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
  tipo,
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
        <label style={styles.label}>Producto</label>
        <Autocomplete
          options={productoOptions}
          value={linea.productoId}
          onChange={onProductoChange}
          placeholder={loadingProductos ? "Cargando productos..." : "Buscar producto..."}
          disabled={disabled || loadingProductos}
          dataTestId={`operaciones-line-${index}-producto`}
          style={styles.autocompleteCompact}
        />
      </div>

      <div>
        <label style={styles.label}>Cantidad</label>
        <input
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          value={linea.cantidad}
          onChange={(e) => onCantidadChange(Number(e.target.value) || 0)}
          style={{ ...styles.input, ...styles.qtyInput }}
          data-testid={`operaciones-line-${index}-cantidad`}
        />
      </div>

      <div>
        <label style={styles.label}>{tipo === "venta" ? "Precio" : "Costo"}</label>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={linea.unitario}
          onChange={(e) => onUnitarioChange(Number(e.target.value) || 0)}
          style={{ ...styles.input, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-unitario`}
        />
      </div>

      <div>
        <label style={styles.label}>Total</label>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={linea.total}
          onChange={(e) => onTotalChange(Number(e.target.value) || 0)}
          style={{ ...styles.input, ...styles.moneyInput }}
          data-testid={`operaciones-line-${index}-total`}
        />
      </div>

      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          css={styles.trashBtn}
          title="Eliminar línea"
          data-testid={`operaciones-line-${index}-remove`}
        >
          <Trash2 size={16} />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

const styles = {
  label: {
    display: "block",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    fontSize: 13,
  } as const,
  qtyInput: {
    width: 60,
    textAlign: "center" as const,
    paddingLeft: 8,
    paddingRight: 8,
  } as const,
  moneyInput: {
    width: 120,
    maxWidth: 140,
    textAlign: "right" as const,
  } as const,
  autocompleteCompact: {
    minWidth: 240,
  } as const,
  lineRow: css({
    display: "grid",
    gridTemplateColumns: "2fr 0.7fr 0.9fr 0.9fr auto",
    gap: 10,
    alignItems: "end",
    [`@media (max-width: 720px)`]: {
      gridTemplateColumns: "1fr 1fr",
    },
  }),
  trashBtn: css({
    height: 34,
    width: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    cursor: "pointer",
  }),
} as const;

