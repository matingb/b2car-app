"use client";

import React from "react";
import { css } from "@emotion/react";
import { Plus } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Button from "@/app/components/ui/Button";
import { formatArs } from "@/lib/format";
import OperacionLineaEditor, { OPERACION_LINE_GRID_TEMPLATE } from "./OperacionLineaEditor";
import { useOperacionForm } from "./OperacionFormContext";

export default function OperacionStockForm() {
  const {
    tipo,
    isTipoEnabled,
    lineas,
    addLinea,
    removeLinea,
    setLineaAt,
    stockOptions,
    isInventarioLoading,
    getDefaultUnitarioForStockId,
  } = useOperacionForm();

  const isEnabled = Boolean(tipo && isTipoEnabled(tipo));

  const totalOperacion = lineas.reduce(
    (acc, l) => acc + (Number(l.total) || 0),
    0
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={styles.sectionHeaderRow}>
        <div style={styles.sectionTitleWrap}>
          <div style={styles.linesTitle}>Detalle de Productos</div>
        </div>
      </div>

      <div css={styles.columnsHeader} aria-hidden="true">
        <div>PRODUCTO</div>
        <div style={{ textAlign: "right" }}>CANT.</div>
        <div style={{ textAlign: "right" }}>UNITARIO</div>
        <div style={{ textAlign: "right" }}>TOTAL</div>
        <div />
      </div>

      <div css={styles.linesList}>
        {lineas.map((l, idx) => {
          const disabled = !isEnabled;
          return (
            <OperacionLineaEditor
              key={l.id || idx}
              index={idx}
              linea={l}
              disabled={disabled}
              loadingStocks={isInventarioLoading}
              stockOptions={stockOptions}
              getDefaultUnitarioForStockId={getDefaultUnitarioForStockId}
              onChange={(next) => setLineaAt(idx, next)}
              onRemove={() => removeLinea(idx)}
              canRemove={lineas.length > 1}
            />
          );
        })}
      </div>

      <div style={styles.addAndTotalRow}>
        <Button
          onClick={addLinea}
          disabled={!isEnabled}
          dataTestId="operaciones-add-line"
          text="Agregar Producto"
          icon={<Plus size={16} />}
          outline
        />

        <div style={styles.totalInline}>
          <div style={styles.totalInlineLabel}>TOTAL OPERACIÓN</div>
          <div style={styles.totalInlineValue}>
            {formatArs(totalOperacion)}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  linesTitle: {
    fontWeight: 600,
    fontSize: 14,
  } as const,
  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  } as const,
  sectionTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as const,
  columnsHeader: css({
    display: "grid",
    gridTemplateColumns: OPERACION_LINE_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 10,
    width: "100%",
    [`@media (max-width: 720px)`]: {
      display: "none",
    },
  }),
  linesList: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  }),
  addAndTotalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  } as const,
  totalInline: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: 2,
  } as const,
  totalInlineLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  } as const,
  totalInlineValue: {
    fontSize: 22,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  } as const,
} as const;
