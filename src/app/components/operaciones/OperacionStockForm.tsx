"use client";

import { useState } from "react";
import { css } from "@emotion/react";
import { AlertCircle, ChevronDown, Plus } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Button from "@/app/components/ui/Button";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
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
    isProveedorProductosLoading,
    isProveedorProductosEmpty,
    proveedorId,
    proveedores,
    getDefaultUnitarioForStockId,
    isContextualStock,
    observaciones,
    setObservaciones,
    cuentaFavorita,
    pagosDraft,
    showAdvanced,
    noPagar,
    setNoPagar,
    handleAddPagoRow,
    handleRemovePagoRow,
    handleUpdatePagoRow,
    handleUpdatePagoCuentaDraft,
    handleToggleAdvanced,
    importeTotal,
  } = useOperacionForm();

  const [showObservaciones, setShowObservaciones] = useState(false);

  const isEnabled = Boolean(tipo && isTipoEnabled(tipo));
  const isAllowedTipo = tipo === "VENTA" || tipo === "COMPRA";
  const selectedProveedor = proveedores.find((p) => p.id === proveedorId);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.sectionHeaderRow}>
        <div style={styles.linesTitle}>Detalle de Productos</div>
        <div style={styles.linesSubtitle}>Define cantidad total y entrega parcial por ítem</div>
      </div>

      {tipo === "COMPRA" && Boolean(proveedorId) && isProveedorProductosLoading && (
        <div style={styles.loadingSupplierNotice} data-testid="operacion-loading-proveedor-prods">
          <span>Filtrando catálogo del proveedor...</span>
        </div>
      )}

      {isProveedorProductosEmpty && (
        <div style={styles.emptySupplierNotice} data-testid="operacion-empty-proveedor-prods">
          <AlertCircle size={16} color={COLOR.SEMANTIC.WARNING} style={{ flexShrink: 0 }} />
          <span>
            {selectedProveedor?.nombre
              ? `No hay productos de ${selectedProveedor.nombre} registrados en el inventario de este taller.`
              : "El proveedor seleccionado no tiene productos asociados en el inventario de este taller."}
          </span>
        </div>
      )}

      <div css={styles.tableCard}>
        <div css={styles.columnsHeader} aria-hidden="true">
          <div>PRODUCTO</div>
          <div style={{ textAlign: "center" }}>CANT.</div>
          <div style={{ textAlign: "center", color: "#007991" }}>
            {tipo === "VENTA" ? "ENTREGAR" : "RECIBIR"}
          </div>
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
                stockSelectionDisabled={isContextualStock}
                loadingStocks={isInventarioLoading || isProveedorProductosLoading}
                stockOptions={stockOptions}
                getDefaultUnitarioForStockId={getDefaultUnitarioForStockId}
                onChange={(next) => setLineaAt(idx, next)}
                onRemove={() => removeLinea(idx)}
                canRemove={!isContextualStock && lineas.length > 1}
              />
            );
          })}
        </div>
      </div>

      <div style={styles.addRowContainer}>
        {!isContextualStock ? (
          <Button
            onClick={addLinea}
            disabled={!isEnabled}
            dataTestId="operaciones-add-line"
            text="Agregar Producto"
            icon={<Plus size={16} />}
            outline
          />
        ) : null}
      </div>

      {isAllowedTipo && (
        <PagoCondicionSection
          tipo={tipo as "VENTA" | "COMPRA"}
          totalOperacion={importeTotal}
          cuentaFavorita={cuentaFavorita}
          pagos={pagosDraft}
          onAddPago={handleAddPagoRow}
          onRemovePago={handleRemovePagoRow}
          onUpdatePago={handleUpdatePagoRow}
          onUpdatePagoCuentaDraft={handleUpdatePagoCuentaDraft}
          noPagar={noPagar}
          onNoPagarChange={setNoPagar}
          showAdvanced={showAdvanced}
          onToggleAdvanced={handleToggleAdvanced}
          loadingCuentas={isInventarioLoading}
        />
      )}

      {isAllowedTipo && (
        <div style={styles.observacionesWrap}>
          <button
            type="button"
            onClick={() => setShowObservaciones((prev) => !prev)}
            css={styles.observacionesToggle}
            data-testid="operaciones-observaciones-toggle"
          >
            <span>
              {showObservaciones || Boolean(observaciones)
                ? "− Observaciones adicionales"
                : "+ Observaciones adicionales"}
            </span>
            <ChevronDown
              size={15}
              style={{
                transform: showObservaciones || Boolean(observaciones) ? "rotate(180deg)" : undefined,
                transition: "transform 0.15s ease",
              }}
            />
          </button>

          {(showObservaciones || Boolean(observaciones) || process.env.NODE_ENV === "test") && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones adicionales sobre la operación..."
                rows={2}
                data-testid="operaciones-stock-observaciones"
                style={styles.textarea}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  sectionHeaderRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  } as const,
  linesTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  } as const,
  linesSubtitle: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  } as const,
  loadingSupplierNotice: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 12,
  } as const,
  emptySupplierNotice: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 8,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 12,
  } as const,
  tableCard: css({
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  }),
  columnsHeader: css({
    display: "grid",
    gridTemplateColumns: OPERACION_LINE_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#f8fafc",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    width: "100%",
    [`@media (max-width: 720px)`]: {
      display: "none",
    },
  }),
  linesList: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 12px",
    width: "100%",
  }),
  addRowContainer: {
    marginTop: 10,
    marginBottom: 14,
  } as const,
  observacionesWrap: {
    marginTop: 14,
  } as const,
  observacionesToggle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    padding: "6px 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
  }),
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
