"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { Operacion, OperacionLinea } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { toISODateLocal, toISODateTimeWithLocalCurrentTime, formatCalendarDateLabel } from "@/lib/fechas";
import Calendar from "@/app/components/ui/Calendar";
import NumberInput from "@/app/components/ui/NumberInput";
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

interface Props {
  open: boolean;
  operacion: Operacion | null;
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
  operacion,
  onClose,
  onSuccess,
}: Props) {
  const { confirmarStock } = useOperaciones();
  const { success, error } = useToast();

  const [fecha, setFecha] = useState(() => toISODateLocal(new Date()));
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isVenta = operacion?.tipo === "VENTA";
  const operacionId = operacion?.id;

  // Inicializar cantidades con el remanente pendiente por línea
  useEffect(() => {
    if (!open || !operacion) return;
    setFecha(toISODateLocal(new Date()));
    setSearch("");

    const initMap: Record<string, number> = {};
    (operacion.lineas ?? []).forEach((linea, index) => {
      const key = linea.id || `linea-${index}`;
      const pendiente = Math.max(0, (linea.cantidad ?? 0) - (linea.cantidad_cumplida ?? 0));
      initMap[key] = pendiente;
    });
    setCantidades(initMap);
  }, [open, operacionId, operacion]);

  const lineasConPendiente = useMemo(() => {
    if (!operacion?.lineas) return [];
    return operacion.lineas.map((linea, index) => {
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
  }, [operacion?.lineas, cantidades]);

  const filteredLineas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lineasConPendiente;

    return lineasConPendiente.filter((item) => {
      const nombre = (item.linea.nombre || "").toLowerCase();
      const codigo = item.codigo.toLowerCase();
      return nombre.includes(q) || codigo.includes(q);
    });
  }, [lineasConPendiente, search]);

  const totalPendiente = useMemo(() => {
    return lineasConPendiente.reduce((sum, item) => sum + item.pendiente, 0);
  }, [lineasConPendiente]);

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
    if (!isValid || !operacion) return;

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
      const ok = await confirmarStock(operacion.id, {
        fecha: fechaIso,
        lineas: lineasPayload,
      });

      if (ok) {
        success(
          isVenta ? "Entrega confirmada" : "Recepción confirmada",
          `Se confirmaron ${totalAConfirmar} unidad(es) de ${isVenta ? "entrega" : "recepción"}.`
        );
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al confirmar stock";
      error("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!operacion) return null;

  const actionVerb = isVenta ? "entregar" : "recibir";
  const actionNoun = isVenta ? "Entrega" : "Recepción";

  return (
    <Modal
      open={open}
      title={`Confirmar ${actionNoun} de Stock`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={
        totalAConfirmar > 0
          ? `Confirmar ${actionNoun} (${totalAConfirmar} u.)`
          : `Confirmar ${actionNoun}`
      }
      submitting={submitting}
      disabledSubmit={!isValid}
      showCloseButton
      modalStyle={{ width: "min(760px, 96vw)" }}
    >
      <div style={styles.container}>
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
              <RotateCcw size={14} color={COLOR.TEXT.SECONDARY} />
              <span>Vaciar</span>
            </button>
          </div>
        </div>

        {/* Tabla de productos */}
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
                    const isFull = item.aConfirmar === item.pendiente && item.pendiente > 0;
                    const isPartial = item.aConfirmar > 0 && item.aConfirmar < item.pendiente;

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
    left: 12,
    pointerEvents: "none" as const,
  },
  searchInput: {
    width: "100%",
    height: 36,
    padding: "0 34px 0 36px",
    borderRadius: 7,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    outline: "none",
  },
  searchClearBtn: {
    position: "absolute" as const,
    right: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 4,
    borderRadius: 4,
  },
  toolbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  btnActionAll: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 7,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  btnClear: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 7,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  tableCard: {
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
  tableScrollWrapper: {
    overflowX: "auto" as const,
    maxHeight: "360px",
    overflowY: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    minWidth: 540,
    textAlign: "left" as const,
  },
  thRow: {
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  th: {
    padding: "10px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  tr: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  td: {
    padding: "10px 14px",
    fontSize: 13.5,
    color: COLOR.TEXT.PRIMARY,
    verticalAlign: "middle" as const,
  },
  emptyCell: {
    padding: "24px 16px",
    textAlign: "center" as const,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  itemInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    minWidth: 0,
  },
  itemNombre: {
    fontSize: 13.5,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.3,
  },
  itemCodigo: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  restaBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 700,
    minWidth: 28,
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  numberInput: {
    width: 64,
    height: 34,
    padding: "0 6px",
    boxSizing: "border-box" as const,
    textAlign: "center" as const,
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    outline: "none",
  },
  btnTodo: {
    height: 34,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
  },
  badgeCompleto: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    color: COLOR.STATUS.SUCCESS.TEXT,
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
    paddingTop: 4,
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

