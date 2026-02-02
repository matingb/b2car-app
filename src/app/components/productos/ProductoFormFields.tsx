"use client";

import React from "react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";

export type ProductoFormFieldsValues = {
  nombre: string;
  codigo: string;
  proveedor: string;
  ubicacion: string;
  precioCompra: number;
  precioVenta: number;
  categorias: string[];
};

type Props = {
  values: ProductoFormFieldsValues;
  onChange: (patch: Partial<ProductoFormFieldsValues>) => void;
  categoriasDisponibles: readonly string[];
};

export default function ProductoFormFields({
  values,
  onChange,
  categoriasDisponibles,
}: Props) {
  const parseNonNegativeNumber = (v: string): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  };

  return (
    <>
      <div css={styles.row}>
        <div style={styles.fieldWide}>
          <label style={styles.label}>
            Nombre{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            style={styles.input}
            value={values.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej: Aceite Motor 10W40 Sintético"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            Código{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            style={styles.input}
            value={values.codigo}
            onChange={(e) => onChange({ codigo: e.target.value })}
            placeholder="Ej: ACE-10W40-SIN"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Proveedor</label>
          <input
            style={styles.input}
            value={values.proveedor}
            onChange={(e) => onChange({ proveedor: e.target.value })}
            placeholder="Ej: Lubricantes del Sur"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Ubicación</label>
          <input
            style={styles.input}
            value={values.ubicacion}
            onChange={(e) => onChange({ ubicacion: e.target.value })}
            placeholder="Ej: Estante A-1"
          />
        </div>
        <div style={styles.field} />
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Precio compra</label>
          <input
            type="number"
            min={0}
            style={styles.input}
            value={values.precioCompra}
            onChange={(e) =>
              onChange({ precioCompra: parseNonNegativeNumber(e.target.value) })
            }
            placeholder="0"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Precio venta</label>
          <input
            type="number"
            min={0}
            style={styles.input}
            value={values.precioVenta}
            onChange={(e) =>
              onChange({ precioVenta: parseNonNegativeNumber(e.target.value) })
            }
            placeholder="0"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.fieldWide}>
          <label style={styles.label}>Categorías</label>
          <DropdownMultiSelect
            options={categoriasDisponibles.map((c) => ({ value: c, label: c }))}
            value={values.categorias}
            onChange={(next) => onChange({ categorias: next })}
            placeholder="Seleccionar categorías..."
          />
        </div>
      </div>
    </>
  );
}

const styles = {
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  field: { flex: 1 },
  fieldWide: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
} as const;
