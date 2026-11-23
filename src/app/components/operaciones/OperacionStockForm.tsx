"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import { AlertCircle, Plus } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Button from "@/app/components/ui/Button";
import ObservacionesCollapsible from "@/app/components/ui/ObservacionesCollapsible";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
import OperacionLineaEditor, {
  OPERACION_LINE_GRID_TEMPLATE,
  OPERACION_LINE_GRID_TEMPLATE_WITH_IVA,
} from "./OperacionLineaEditor";
import { useOperacionForm } from "./OperacionFormContext";
import OperacionFacturaPercepciones from "./OperacionFacturaPercepciones";

export default function OperacionStockForm() {
  const {
    tipo,
    isTipoEnabled,
    lineas,
    addLinea,
    removeLinea,
    setLineaAt,
    stockOptions,
    stockById,
    getDefaultUnitarioForStockId,
    getStockActualForStockId,
    isInventarioLoading,
    isProveedorProductosLoading,
    isProveedorProductosEmpty,
    proveedorId,
    proveedores,
    clienteId,
    clientes,
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
    factura,
    puedeCargarComprobante,
    open,
  } = useOperacionForm();

  const [activeLineaId, setActiveLineaId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const suppressSingleLineaAutoExpandRef = useRef(false);
  const firstLineaId = lineas[0]?.id ?? "0";

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 720px)");
    if (!mediaQuery) return;

    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);
    return () => mediaQuery.removeEventListener?.("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setActiveLineaId(null);
      return;
    }
    if (open && lineas.length === 1) {
      if (suppressSingleLineaAutoExpandRef.current) {
        suppressSingleLineaAutoExpandRef.current = false;
        return;
      }
      setActiveLineaId(firstLineaId);
    }
  }, [open, isMobileViewport, lineas.length, firstLineaId]);

  const isEnabled = Boolean(tipo && isTipoEnabled(tipo));
  const isAllowedTipo = tipo === "VENTA" || tipo === "COMPRA";
  const stockOptionsByLinea = useMemo(() => {
    if (tipo !== "COMPRA") return lineas.map(() => stockOptions);

    const stockIdsSeleccionados = new Set(
      lineas.map((linea) => linea.stockId).filter(Boolean),
    );

    return lineas.map((linea) => stockOptions.filter(
      (option) => option.value === linea.stockId || !stockIdsSeleccionados.has(option.value),
    ));
  }, [lineas, stockOptions, tipo]);
  const showIvaAlicuota = tipo === "COMPRA"
    && puedeCargarComprobante
    && factura.activa
    && (factura.draft.clase === "A" || factura.draft.clase === "B");
  const lineGridTemplate = showIvaAlicuota ? OPERACION_LINE_GRID_TEMPLATE_WITH_IVA : OPERACION_LINE_GRID_TEMPLATE;
  const selectedProveedor = proveedores.find((p) => p.id === proveedorId);
  const selectedCliente = clientes.find((c) => c.id === clienteId);
  const contraparteNombre = tipo === "VENTA" ? selectedCliente?.nombre : selectedProveedor?.nombre;

  const hasEntregarExcedido = lineas.some((l) => {
    const cant = Number(l.cantidad) || 0;
    const ent = l.cantidadEntregar !== undefined ? Number(l.cantidadEntregar) : cant;
    return ent > cant;
  });

  const lineasSinStockFisico = useMemo(() => {
    if (tipo !== "VENTA") return [];
    return lineas
      .map((l) => {
        if (!l.stockId) return null;
        const item = stockById.get(l.stockId);
        const stockActual = item ? Number(item.stockActual) || 0 : 0;
        const cant = Number(l.cantidad) || 0;
        const ent = l.cantidadEntregar !== undefined ? Number(l.cantidadEntregar) : cant;
        if (ent > stockActual) {
          return { stockActual, ent, cant };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tipo, lineas, stockById]);

  const hasEntregarSinStockFisico = lineasSinStockFisico.length > 0;
  const stockActualExcedido = lineasSinStockFisico[0]?.stockActual ?? 0;

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
          <div css={styles.columnsHeader} style={{ gridTemplateColumns: lineGridTemplate }} aria-hidden="true">
            <div>PRODUCTO</div>
            <div style={{ textAlign: "center" }}>CANT.</div>
            <div style={{ textAlign: "center" }}>
              {tipo === "VENTA" ? "ENTREGAR" : "RECIBIR"}
            </div>
            {showIvaAlicuota ? <div style={{ textAlign: "center" }}>ALÍCUOTA IVA</div> : null}
            <div style={{ textAlign: "right" }}>UNITARIO</div>
            <div style={{ textAlign: "right" }}>TOTAL</div>
            <div />
          </div>

          <div css={styles.linesList}>
            {lineas.map((l, idx) => {
              const disabled = !isEnabled;
              const lineKey = l.id ?? String(idx);
              return (
                <OperacionLineaEditor
                  key={l.id || idx}
                  index={idx}
                  linea={l}
                  productCode={stockById.get(l.stockId)?.codigo}
                  mobileExpanded={activeLineaId === lineKey}
                  canMobileExpand={activeLineaId === null || activeLineaId === lineKey}
                  canMobileDelete={!isContextualStock}
                  onMobileActivate={() => {
                    if (isMobileViewport) setActiveLineaId((current) => current ?? lineKey);
                  }}
                  onMobileToggle={() => setActiveLineaId((current) => (current === lineKey ? null : lineKey))}
                  onMobileConfirm={() => {
                    if (l.stockId) setActiveLineaId((current) => (current === lineKey ? null : current));
                  }}
                  disabled={disabled}
                  stockSelectionDisabled={isContextualStock}
                  loadingStocks={isInventarioLoading || isProveedorProductosLoading}
                  stockOptions={stockOptionsByLinea[idx] ?? stockOptions}
                  getDefaultUnitarioForStockId={getDefaultUnitarioForStockId}
                  getDefaultIvaAlicuotaIdForStockId={(stockId) => stockById.get(stockId)?.ivaAlicuotaId ?? null}
                  getStockActualForStockId={getStockActualForStockId}
                  isVenta={tipo === "VENTA"}
                  showIvaAlicuota={showIvaAlicuota}
                  onChange={(next) => setLineaAt(idx, next)}
                  onRemove={() => {
                    if (isMobileViewport && lineas.length === 2 && activeLineaId === lineKey) {
                      suppressSingleLineaAutoExpandRef.current = true;
                    }
                    removeLinea(idx);
                    setActiveLineaId((current) => (current === lineKey ? null : current));
                  }}
                  canRemove={!isContextualStock && lineas.length > 1}
                />
              );
            })}
          </div>
        </div>

        {hasEntregarExcedido && (
          <div style={styles.errorNotice} data-testid="operacion-stock-entregar-error">
            <AlertCircle size={16} color={COLOR.STATUS.DANGER.TEXT} style={{ flexShrink: 0 }} />
            <span>
              La cantidad a {tipo === "VENTA" ? "entregar" : "recibir"} no puede superar la cantidad pactada.
            </span>
          </div>
        )}

        {hasEntregarSinStockFisico && !hasEntregarExcedido && (
          <div style={styles.errorNotice} data-testid="operacion-stock-fisico-error">
            <AlertCircle size={16} color={COLOR.STATUS.DANGER.TEXT} style={{ flexShrink: 0 }} />
            <span>
              No hay stock físico suficiente en taller ({stockActualExcedido} u.) para entregar en este momento.
            </span>
          </div>
        )}

        {!isContextualStock && (
          <div css={styles.addRowContainer}>
            <Button
              type="button"
              onClick={() => {
                const nuevaLineaId = addLinea();
                if (isMobileViewport) setActiveLineaId(nuevaLineaId);
              }}
              disabled={!isEnabled || (isMobileViewport && activeLineaId !== null)}
              dataTestId="operaciones-add-line"
              text="Agregar Producto"
              icon={<Plus size={16} />}
              outline
            />
          </div>
        )}
      </div>

      {tipo === "COMPRA" && puedeCargarComprobante && factura.activa && <OperacionFacturaPercepciones />}

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
  errorNotice: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: COLOR.STATUS.DANGER.BG_SUBTLE,
    borderRadius: 8,
    fontSize: 13,
    color: COLOR.STATUS.DANGER.TEXT,
    marginTop: 12,
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
    ["@media (max-width: 720px)"]: {
      gap: 0,
      padding: "0 12px",
    },
  }),
  addRowContainer: css({
    marginTop: 10,
    "@media (max-width: 720px)": {
      display: "flex",
      justifyContent: "center",
      "& > button": {
        width: "100%",
        minWidth: 0,
        height: 44,
        boxSizing: "border-box",
        padding: "12px 14px",
        border: `2px dashed ${COLOR.BORDER.SUBTLE}`,
        borderRadius: 12,
        background: "transparent",
        color: COLOR.TEXT.SECONDARY,
        "&:hover:not(:disabled)": {
          border: `2px dashed ${COLOR.BORDER.SUBTLE}`,
          background: "transparent",
          color: COLOR.TEXT.SECONDARY,
        },
      },
    },
  }),
} as const;
