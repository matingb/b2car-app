"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { CATEGORIAS_GASTO } from "@/model/finanzas";
import { useOperacionForm } from "./OperacionFormContext";

export default function OperacionGastoForm() {
  const {
    categoriaGasto,
    setCategoriaGasto,
    montoGasto,
    setMontoGasto,
    descripcionGasto,
    setDescripcionGasto,
  } = useOperacionForm();

  return (
    <div css={styles.gastoFormContainer}>
      <div css={styles.gastoRow}>
        <div style={styles.formField}>
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

        <div style={styles.formField}>
          <label style={styles.label}>Monto</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={montoGasto}
            onChange={(e) => setMontoGasto(e.target.value)}
            data-testid="gasto-importe"
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formFieldFull}>
        <label style={styles.label}>Descripción</label>
        <textarea
          value={descripcionGasto}
          onChange={(e) => setDescripcionGasto(e.target.value)}
          placeholder="Motivo o detalle del gasto..."
          rows={3}
          data-testid="gasto-descripcion"
          style={styles.textarea}
        />
      </div>
    </div>
  );
}

const styles = {
  gastoFormContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 16,
  }),
  gastoRow: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  formField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  formFieldFull: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    width: "100%",
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
