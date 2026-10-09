"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { CATEGORIAS_GASTO } from "@/model/finanzas";

type Props = {
  categoriaGasto: string;
  setCategoriaGasto: (categoria: string) => void;
  montoGasto: string;
  setMontoGasto: (monto: string) => void;
  descripcionGasto: string;
  setDescripcionGasto: (descripcion: string) => void;
  observacionesGasto?: string;
  setObservacionesGasto?: (observaciones: string) => void;
};

export default function GastoFormFields({
  categoriaGasto,
  setCategoriaGasto,
  montoGasto,
  setMontoGasto,
  descripcionGasto,
  setDescripcionGasto,
  observacionesGasto,
  setObservacionesGasto,
}: Props) {
  return (
    <div css={styles.container}>
      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Categoría</label>
          <Autocomplete
            value={categoriaGasto}
            onChange={setCategoriaGasto}
            options={[...CATEGORIAS_GASTO]}
            placeholder="Seleccionar categoría"
            dataTestId="gasto-categoria"
            hideClearButton
            style={{ height: 44, fontSize: 14 }}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Monto</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={montoGasto}
            onChange={(event) => setMontoGasto(event.target.value)}
            data-testid="gasto-importe"
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Descripción (opcional)</label>
        <textarea
          value={descripcionGasto}
          onChange={(event) => setDescripcionGasto(event.target.value)}
          placeholder="Motivo o detalle del gasto..."
          rows={3}
          data-testid="gasto-descripcion"
          style={styles.textarea}
        />
      </div>

      {setObservacionesGasto !== undefined && (
        <div style={styles.field}>
          <label style={styles.label}>Observaciones</label>
          <textarea
            value={observacionesGasto ?? ""}
            onChange={(event) => setObservacionesGasto(event.target.value)}
            placeholder="Observaciones adicionales sobre la operación..."
            rows={2}
            data-testid="gasto-observaciones"
            style={styles.textarea}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 16,
  }),
  row: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 0,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  input: {
    height: 44,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    width: "100%",
  } as const,
  textarea: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    resize: "vertical" as const,
    lineHeight: "1.5",
    width: "100%",
  } as const,
} as const;
