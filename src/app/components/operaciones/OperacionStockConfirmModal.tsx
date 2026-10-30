"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Button from "@/app/components/ui/Button";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import type { Operacion, OperacionLinea } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { toISODateLocal, toISODateTimeWithLocalCurrentTime, formatCalendarDateLabel } from "@/lib/fechas";
import Calendar from "@/app/components/ui/Calendar";
import NumberInput from "@/app/components/ui/NumberInput";
import OperacionStockHistorial from "./OperacionStockHistorial";
import { useRevertirMovimientoStock } from "./useRevertirMovimientoStock";
import { logger } from "@/lib/logger";
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

export interface OperacionStockConfirmModalProps {
  open: boolean;
  operacionId?: string | number;
  operacion?: Operacion | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function getLineaCodigo(linea: OperacionLinea, fallbackKey: string): string {
  if (linea.codigo) {
    return linea.codigo.startsWith("#") ? linea.codigo : `#${linea.codigo}`;
  }
  const raw = (linea.stock_id || linea.id || fallbackKey).replace(/[^a-zA-Z0-9]/g, "");
  return `#${raw.slice(0, 6)}`;
}

export default function OperacionStockConfirmModal({
  open,
  operacionId: propOperacionId,
  operacion: initialOperacion,
  onClose,
  onSuccess,
}: OperacionStockConfirmModalProps) {
  const { confirmarStock, fetchById } = useOperaciones();
  const { success, error } = useToast();

  const [detailedOp, setDetailedOp] = useState<Operacion | null>(null);
  const [, setLoadingData] = useState(false);
  const inFlightRef = useRef(false);

  const targetOperacionId = propOperacionId ?? initialOperacion?.id;

  const loadOperacionDetails = useCallback(async () => {
    if (!targetOperacionId || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingData(true);
    try {
      const fresh = await fetchById(targetOperacionId);
      if (fresh) {
        setDetailedOp(fresh);
      }
    } catch (err) {
      logger.error("Error loading operacion details for stock modal:", err);
    } finally {
      setLoadingData(false);
      inFlightRef.current = false;
    }
  }, [targetOperacionId, fetchById]);

  useEffect(() => {
    if (open) {
      void loadOperacionDetails();
    } else {
      setDetailedOp(null);
    }
  }, [open, loadOperacionDetails]);

  const activeOp = detailedOp ?? initialOperacion;

  const [fecha, setFecha] = useState(() => toISODateLocal(new Date()));
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { revertiendoMovId, handleRevertirMovimiento } = useRevertirMovimientoStock({
    operacion: activeOp,
    onSuccess: (updated) => {
      setDetailedOp(updated);
      onSuccess?.();
    },
  });

  const isVenta = activeOp?.tipo === "VENTA";
  const activeOpId = activeOp?.id;

  // Inicializar cantidades con el remanente pendiente por línea
  useEffect(() => {
    if (!open || !activeOpId) return;
    setFecha(toISODateLocal(new Date()));
    setSearch("");

    const initMap: Record<string, number> = {};
    (activeOp?.lineas ?? []).forEach((linea, index) => {
      const key = linea.id || `linea-${index}`;
      const pendiente = Math.max(0, (linea.cantidad ?? 0) - (linea.cantidad_cumplida ?? 0));
      initMap[key] = pendiente;
    });
    setCantidades(initMap);
  }, [open, activeOpId, activeOp?.lineas]);

  const lineasConPendiente = useMemo(() => {
    if (!activeOp?.lineas) return [];
    return activeOp.lineas.map((linea, index) => {
      const key = linea.id || `linea-${index}`;
      const total = linea.cantidad ?? 0;
      const cumplidas = linea.cantidad_cumplida ?? 0;
      const pendiente = Math.max(0, total - cumplidas);
      const aConfirmar = cantidades[key] ?? 0;
      const codigo = getLineaCodigo(linea, key);
      return {
        linea,
        key,
        total,
        cumplidas,
        pendiente,
        aConfirmar,
        codigo,
      };
    });
  }, [activeOp?.lineas, cantidades]);

  const filteredLineas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lineasConPendiente;

    return lineasConPendiente.filter((item) => {
      const nombre = (item.linea.nombre || "").toLowerCase();
      const codigo = item.codigo.toLowerCase();
      return nombre.includes(q) || codigo.includes(q);
    });
  }, [lineasConPendiente, search]);

  const totalPactadas = useMemo(() => {
    return (activeOp?.lineas ?? []).reduce((sum, l) => sum + (l.cantidad ?? 0), 0);
  }, [activeOp?.lineas]);

  const totalPendiente = useMemo(() => {
    return lineasConPendiente.reduce((sum, item) => sum + item.pendiente, 0);
  }, [lineasConPendiente]);

  const isFullyDelivered = totalPendiente <= 0 && totalPactadas > 0;

  const totalAConfirmar = useMemo(() => {
    return lineasConPendiente.reduce((sum, item) => sum + item.aConfirmar, 0);
  }, [lineasConPendiente]);

  const remanenteFinal = Math.max(0, totalPendiente - totalAConfirmar);

  const isValid = useMemo(() => {
    if (totalAConfirmar <= 0) return false;
    for (const item of lineasConPendiente) {
      if (item.aConfirmar < 0 || item.aConfirmar > item.pendiente) {
        return false;
      }
    }
    return true;
  }, [totalAConfirmar, lineasConPendiente]);

  const handleSetCantidad = (key: string, value: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(value) ? 0 : Math.floor(value)));
    setCantidades((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleSelectAll = () => {
    const fullMap: Record<string, number> = {};
    lineasConPendiente.forEach((item) => {
      fullMap[item.key] = item.pendiente;
    });
    setCantidades(fullMap);
  };

  const handleClearAll = () => {
    const emptyMap: Record<string, number> = {};
    lineasConPendiente.forEach((item) => {
      emptyMap[item.key] = 0;
    });
    setCantidades(emptyMap);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !activeOp) return;

    setSubmitting(true);
    try {
      const lineasPayload = lineasConPendiente
        .filter((item) => item.aConfirmar > 0)
        .map((item) => ({
          lineaId: item.linea.id,
          stockId: item.linea.stock_id,
          cantidad: item.aConfirmar,
        }));

      const fechaIso = toISODateTimeWithLocalCurrentTime(fecha) ?? new Date().toISOString();
      const ok = await confirmarStock(activeOp.id, {
        fecha: fechaIso,
        lineas: lineasPayload,
      });

      if (ok) {
        success(
          isVenta ? "Entrega confirmada" : "Recepción confirmada",
          `Se confirmaron ${totalAConfirmar} unidad(es) de ${isVenta ? "entrega" : "recepción"}.`
        );
        onSuccess?.();
        void loadOperacionDetails();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al confirmar stock";
      error("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeOp) return null;

  const actionVerb = isVenta ? "entregar" : "recibir";
  const actionNoun = isVenta ? "Entrega" : "Recepción";

  return (
    <Modal
      open={open}
      title={
        isFullyDelivered
          ? isVenta
            ? "Gestión de Entrega de Stock"
            : "Gestión de Recepción de Stock"
          : `Confirmar ${actionNoun} de Stock`
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={
        totalAConfirmar > 0
          ? `Confirmar ${actionNoun} (${totalAConfirmar} u.)`
          : `Confirmar ${actionNoun}`
      }
      submitting={submitting}
      disabledSubmit={!isValid}
      showCloseButton={!isFullyDelivered}
      hideFooter={isFullyDelivered}
      wrapInForm={!isFullyDelivered}
      modalStyle={{ width: "min(760px, 96vw)" }}
    >
      <div style={styles.container}>
        {isFullyDelivered ? (
          <>
            <div style={styles.alertSuccess} data-testid="stock-completado-alert">
              <CheckCircle2 size={18} color={COLOR.STATUS.SUCCESS.TEXT} />
              <span>
                Todo el stock de esta operación se encuentra {isVenta ? "entregado" : "recibido"}.
              </span>
            </div>

            {/* Tabla resumen en modo lectura */}
            <div style={styles.tableCard}>
              <div style={styles.tableScrollWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={{ ...styles.th, textAlign: "left", width: "50%" }}>
                        Producto / Ítem
                      </th>
                      <th style={{ ...styles.th, textAlign: "center", width: "25%" }}>
                        Pactadas
                      </th>
                      <th style={{ ...styles.th, textAlign: "center", width: "25%" }}>
                        {isVenta ? "Entregadas" : "Recibidas"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLineas.map((item) => (
                      <tr
                        key={item.key}
                        style={styles.tr}
                        data-testid={`stock-summary-row-${item.key}`}
                      >
                        <td style={styles.td}>
                          <div style={styles.itemInfo}>
                            <strong style={styles.itemNombre}>
                              {item.linea.nombre || `Ítem #${item.key.slice(0, 6)}`}
                            </strong>
                            <span style={styles.itemCodigo}>{item.codigo}</span>
                          </div>
                        </td>

                        <td style={{ ...styles.td, textAlign: "center", fontWeight: 500 }}>
                          {item.total}
                        </td>

                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            fontWeight: 600,
                            color: COLOR.STATUS.SUCCESS.TEXT,
                          }}
                        >
                          {item.cumplidas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <OperacionStockHistorial
              movimientos={activeOp.movimientos_stock}
              tipo={activeOp.tipo}
              revertiendoMovimientoId={revertiendoMovId}
              onRevertirMovimiento={handleRevertirMovimiento}
            />

            <div style={styles.footerSingleClose}>
              <Button
                text="Cerrar"
                onClick={onClose}
                dataTestId="operacion-stock-close-btn"
              />
            </div>
          </>
        ) : (
          <>
            <p style={styles.instruction}>
              Indicá cuántas unidades vas a {actionVerb} físicamente en esta oportunidad. Podés confirmar entregas parciales.
            </p>

            {/* Toolbar con buscador y botones de acción rápida */}
            <div style={styles.toolbar}>
              <div style={styles.searchContainer}>
                <Search size={15} color={COLOR.TEXT.SECONDARY} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por código o descripción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={styles.searchInput}
                  data-testid="stock-confirm-search"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={styles.searchClearBtn}
                    title="Limpiar búsqueda"
                  >
                    <X size={14} color={COLOR.TEXT.SECONDARY} />
                  </button>
                ) : null}
              </div>

              <div style={styles.toolbarActions}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={styles.btnActionAll}
                  data-testid="stock-confirm-all-btn"
                >
                  <CheckCircle2 size={15} color={COLOR.STATUS.SUCCESS.TEXT} />
                  <span>{isVenta ? "Entregar todos" : "Recibir todos"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={styles.btnClear}
                  data-testid="stock-confirm-clear-btn"
                >
                  <RotateCcw size={15} color={COLOR.TEXT.SECONDARY} />
                  <span>Vaciar</span>
                </button>
              </div>
            </div>

            {/* Tabla de productos interactiva */}
            <div style={styles.tableCard}>
              <div style={styles.tableScrollWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={{ ...styles.th, textAlign: "left", width: "42%" }}>
                        Producto / Ítem
                      </th>
                      <th style={{ ...styles.th, textAlign: "center", width: "13%" }}>
                        Pactadas
                      </th>
                      <th style={{ ...styles.th, textAlign: "center", width: "13%" }}>
                        {isVenta ? "Entregadas" : "Recibidas"}
                      </th>
                      <th style={{ ...styles.th, textAlign: "center", width: "12%" }}>
                        Resta
                      </th>
                      <th style={{ ...styles.th, textAlign: "right", width: "20%" }}>
                        A {actionVerb} ahora
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLineas.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={styles.emptyCell}>
                          No se encontraron ítems que coincidan con &ldquo;{search}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredLineas.map((item) => {
                        const isCompleted = item.pendiente === 0;

                        return (
                          <tr
                            key={item.key}
                            style={{
                              ...styles.tr,
                              opacity: isCompleted ? 0.6 : 1,
                              backgroundColor: isCompleted ? COLOR.BACKGROUND.SUBTLE : "transparent",
                            }}
                            data-testid={`stock-confirm-row-${item.key}`}
                          >
                            <td style={styles.td}>
                              <div style={styles.itemInfo}>
                                <strong style={styles.itemNombre}>
                                  {item.linea.nombre || `Ítem #${item.key.slice(0, 6)}`}
                                </strong>
                                <span style={styles.itemCodigo}>{item.codigo}</span>
                              </div>
                            </td>

                            <td style={{ ...styles.td, textAlign: "center", fontWeight: 500 }}>
                              <span title={`Pactadas: ${item.total}`}>{item.total}</span>
                            </td>

                            <td style={{ ...styles.td, textAlign: "center", fontWeight: 500 }}>
                              <span title={`Cumplidas: ${item.cumplidas}`}>{item.cumplidas}</span>
                            </td>

                            <td style={{ ...styles.td, textAlign: "center" }}>
                              <span
                                style={{
                                  ...styles.restaBadge,
                                  backgroundColor:
                                    item.pendiente > 0
                                      ? COLOR.STATUS.WARNING.BG_SUBTLE
                                      : COLOR.BACKGROUND.SUBTLE,
                                  color:
                                    item.pendiente > 0
                                      ? COLOR.STATUS.WARNING.TEXT
                                      : COLOR.TEXT.SECONDARY,
                                  border:
                                    item.pendiente > 0
                                      ? "1px solid rgba(245, 158, 11, 0.25)"
                                      : `1px solid ${COLOR.BORDER.SUBTLE}`,
                                }}
                                title={`Resta: ${item.pendiente}`}
                              >
                                {item.pendiente}
                              </span>
                            </td>

                            <td style={{ ...styles.td, textAlign: "right" }}>
                              {isCompleted ? (
                                <span style={styles.badgeCompleto}>
                                  <CheckCircle2 size={14} color={COLOR.STATUS.SUCCESS.TEXT} />
                                  <span>Completa</span>
                                </span>
                              ) : (
                                <div style={styles.inputGroup}>
                                  <NumberInput
                                    minValue={0}
                                    max={item.pendiente}
                                    allowDecimals={false}
                                    value={item.aConfirmar}
                                    onValueChange={(val) =>
                                      handleSetCantidad(item.key, val, item.pendiente)
                                    }
                                    style={{
                                      ...styles.numberInput,
                                      color: COLOR.TEXT.PRIMARY,
                                    }}
                                    data-testid={`stock-confirm-input-${item.key}`}
                                    aria-label={`Cantidad a ${actionVerb} de ${item.linea.nombre || item.key}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSetCantidad(item.key, item.pendiente, item.pendiente)}
                                    style={styles.btnTodo}
                                    title="Confirmar todo el saldo restante"
                                    data-testid={`stock-confirm-btn-todo-${item.key}`}
                                  >
                                    Todo
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer info: estado acumulado & fecha del movimiento */}
            <div style={styles.footerRow}>
              <div style={styles.statusIndicator}>
                {remanenteFinal > 0 ? (
                  <>
                    <AlertCircle size={16} color={COLOR.STATUS.WARNING.TEXT} />
                    <span style={styles.statusText}>
                      {actionNoun} parcial (
                      <span style={{ color: COLOR.STATUS.WARNING.TEXT }}>
                        {remanenteFinal} u. restantes
                      </span>
                      )
                    </span>
                  </>
                ) : totalAConfirmar > 0 ? (
                  <>
                    <CheckCircle2 size={16} color={COLOR.STATUS.SUCCESS.TEXT} />
                    <span style={styles.statusText}>
                      {actionNoun} total ({totalAConfirmar} u.)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} color={COLOR.TEXT.SECONDARY} />
                    <span style={{ ...styles.statusText, color: COLOR.TEXT.SECONDARY }}>
                      Sin unidades a {actionVerb}
                    </span>
                  </>
                )}
              </div>

              <div style={styles.fechaContainer}>
                <label style={styles.labelFecha}>Fecha del movimiento:</label>
                <div style={styles.calendarWrapper}>
                  <Calendar
                    value={fecha}
                    onChange={setFecha}
                    dataTestId="stock-confirm-fecha"
                    formatLabel={formatCalendarDateLabel}
                    style={styles.calendarTrigger}
                  />
                </div>
              </div>
            </div>

            {/* Historial colapsable de entregas previas con opción de reversión */}
            {activeOp.movimientos_stock && activeOp.movimientos_stock.length > 0 ? (
              <OperacionStockHistorial
                movimientos={activeOp.movimientos_stock}
                tipo={activeOp.tipo}
                revertiendoMovimientoId={revertiendoMovId}
                onRevertirMovimiento={handleRevertirMovimiento}
              />
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: "4px 0",
  },
  alertSuccess: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: COLOR.STATUS.SUCCESS.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.SUCCESS.BORDER}`,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.4,
  },
  footerSingleClose: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  instruction: {
    fontSize: 13.5,
    color: COLOR.TEXT.SECONDARY,
    margin: "0 0 4px 0",
    lineHeight: 1.45,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  searchContainer: {
    position: "relative" as const,
    flex: 1,
    minWidth: 220,
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute" as const,
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none" as const,
  },
  searchInput: {
    width: "100%",
    height: 36,
    boxSizing: "border-box" as const,
    padding: "0 30px 0 32px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    outline: "none",
  },
  searchClearBtn: {
    position: "absolute" as const,
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    padding: 2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  toolbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  btnActionAll: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    boxSizing: "border-box" as const,
    padding: "0 12px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  btnClear: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    boxSizing: "border-box" as const,
    padding: "0 12px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  tableCard: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
  },
  tableScrollWrapper: {
    maxHeight: 280,
    overflowY: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  thRow: {
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    borderBottom: `1px solid ${COLOR.BORDER.DEFAULT}`,
    position: "sticky" as const,
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  tr: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    transition: "background-color 0.12s ease",
  },
  td: {
    padding: "8px 12px",
    color: COLOR.TEXT.PRIMARY,
    verticalAlign: "middle",
  },
  itemInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  itemNombre: {
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
  },
  itemCodigo: {
    fontSize: 11.5,
    color: COLOR.TEXT.SECONDARY,
    fontFamily: "monospace",
  },
  restaBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11.5,
    fontWeight: 700,
  },
  badgeCompleto: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.STATUS.SUCCESS.TEXT,
  },
  inputGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-end",
  },
  numberInput: {
    width: 68,
    height: 30,
    fontSize: 13,
    textAlign: "right" as const,
  },
  btnTodo: {
    padding: "4px 8px",
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 4,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
  },
  emptyCell: {
    padding: "24px 12px",
    textAlign: "center" as const,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  footerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
    flexWrap: "wrap" as const,
  },
  statusIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },
  statusText: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  fechaContainer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  labelFecha: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  calendarWrapper: {
    width: 155,
  },
  calendarTrigger: {
    height: 36,
    padding: "0 10px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
};
