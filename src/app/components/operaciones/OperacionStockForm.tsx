"use client";

import { css } from "@emotion/react";
import { AlertCircle, Plus } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Button from "@/app/components/ui/Button";
import ObservacionesCollapsible from "@/app/components/ui/ObservacionesCollapsible";
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
    clienteId,
    clientes,
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
    handleRestoreFavorita,
    handleUpdatePagoRow,
    handleUpdatePagoCuentaDraft,
    handleToggleAdvanced,
    importeTotal,
  } = useOperacionForm();


  const isEnabled = Boolean(tipo && isTipoEnabled(tipo));
  const isAllowedTipo = tipo === "VENTA" || tipo === "COMPRA";
  const selectedProveedor = proveedores.find((p) => p.id === proveedorId);
  const selectedCliente = clientes.find((c) => c.id === clienteId);
  const contraparteNombre = tipo === "VENTA" ? selectedCliente?.nombre : selectedProveedor?.nombre;

  return (
    <div css={styles.container}>
      <div>
        <div style={styles.sectionHeaderRow}>
          <div style={styles.linesTitle}>Detalle de Productos</div>
        </div>

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
            <div style={{ textAlign: "center" }}>
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

        {!isContextualStock && (
          <div style={styles.addRowContainer}>
            <Button
              onClick={addLinea}
              disabled={!isEnabled}
              dataTestId="operaciones-add-line"
              text="Agregar Producto"
              icon={<Plus size={16} />}
              outline
            />
          </div>
        )}
      </div>

      {isAllowedTipo && (
        <PagoCondicionSection
          tipo={tipo as "VENTA" | "COMPRA"}
          totalOperacion={importeTotal}
          cuentaFavorita={cuentaFavorita}
          contraparteNombre={contraparteNombre}
          pagos={pagosDraft}
          onAddPago={handleAddPagoRow}
          onRemovePago={handleRemovePagoRow}
          onRestoreFavorita={handleRestoreFavorita}
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
        <ObservacionesCollapsible
          value={observaciones}
          onChange={setObservaciones}
          dataTestId="operaciones-stock-observaciones"
        />
      )}
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
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
  } as const,
} as const;
