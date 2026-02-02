"use client";

import React from "react";
import FilterChip from "@/app/components/ui/FilterChip";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

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
  showRequiredAsterisk?: boolean;
};

export default function ProductoFormFields({
  values,
  onChange,
  categoriasDisponibles,
  showRequiredAsterisk = true,
}: Props) {
  const toggleCategoria = (cat: string) => {
    onChange({
      categorias: values.categorias.includes(cat)
        ? values.categorias.filter((c) => c !== cat)
        : [...values.categorias, cat],
    });
  };

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
            {showRequiredAsterisk ? (
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            ) : null}
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
            {showRequiredAsterisk ? (
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            ) : null}
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
            onChange={(e) => onChange({ precioCompra: parseNonNegativeNumber(e.target.value) })}
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
            onChange={(e) => onChange({ precioVenta: parseNonNegativeNumber(e.target.value) })}
            placeholder="0"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.fieldWide}>
          <label style={styles.label}>Categorías</label>
          <div css={styles.chips}>
            {categoriasDisponibles.map((cat) => (
              <FilterChip
                key={cat}
                text={cat}
                selected={values.categorias.includes(cat)}
                onClick={() => toggleCategoria(cat)}
              />
            ))}
          </div>
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
  chips: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }),
} as const;

