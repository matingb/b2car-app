"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { Operacion } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { toISODateLocal, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import { Check, PackageCheck } from "lucide-react";

interface Props {
  open: boolean;
  operacion: Operacion | null;
  onClose: () => void;
  onSuccess?: () => void;
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
  const [submitting, setSubmitting] = useState(false);

  const isVenta = operacion?.tipo === "VENTA";
  const operacionId = operacion?.id;

  // Inicializar cantidades con el remanente pendiente por línea
  useEffect(() => {
    if (!open || !operacion) return;
    setFecha(toISODateLocal(new Date()));

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
      return {
        linea,
        key,
        total,
        cumplidas,
        pendiente,
        aConfirmar,
      };
    });
  }, [operacion?.lineas, cantidades]);

  const totalAConfirmar = useMemo(() => {
    return lineasConPendiente.reduce((sum, item) => sum + item.aConfirmar, 0);
  }, [lineasConPendiente]);

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
      modalStyle={{ width: "min(600px, 96vw)" }}
    >
      <div style={styles.container}>
        <p style={styles.instruction}>
          Indicá cuántas unidades vas a {actionVerb} físicamente en esta oportunidad. Podés confirmar entregas parciales.
        </p>

        {/* Tabla / Lista de líneas */}
        <div style={styles.lineasContainer}>
          <div style={styles.lineasHeader}>
            <span>Producto / Ítem</span>
            <span style={{ textAlign: "right" }}>A {actionVerb} ahora</span>
          </div>

          {lineasConPendiente.map((item) => {
            const isCompleted = item.pendiente === 0;
            return (
              <div
                key={item.key}
                style={{
                  ...styles.lineaRow,
                  opacity: isCompleted ? 0.6 : 1,
                  backgroundColor: isCompleted ? COLOR.BACKGROUND.SUBTLE : "transparent",
                }}
              >
                <div style={styles.lineaInfo}>
                  <strong style={styles.lineaNombre}>
                    {item.linea.nombre || `Ítem #${item.key.slice(0, 6)}`}
                  </strong>
                  <span style={styles.lineaStats}>
                    Pactadas: {item.total} | Ya {isVenta ? "entregadas" : "recibidas"}: {item.cumplidas} |{" "}
                    <strong style={{ color: item.pendiente > 0 ? COLOR.SEMANTIC.WARNING : COLOR.SEMANTIC.SUCCESS }}>
                      Resta: {item.pendiente}
                    </strong>
                  </span>
                </div>

                <div style={styles.lineaAction}>
                  {isCompleted ? (
                    <span style={styles.badgeCompleto}>
                      <Check size={14} /> Completa
                    </span>
                  ) : (
                    <div style={styles.inputGroup}>
                      <input
                        type="number"
                        min="0"
                        max={item.pendiente}
                        step="1"
                        value={item.aConfirmar}
                        onChange={(e) =>
                          handleSetCantidad(item.key, Number(e.target.value), item.pendiente)
                        }
                        style={styles.numberInput}
                        data-testid={`stock-confirm-input-${item.key}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSetCantidad(item.key, item.pendiente, item.pendiente)}
                        style={styles.btnTodo}
                        title="Confirmar todo el saldo restante"
                      >
                        Todo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones rápidas & Fecha */}
        <div style={styles.footerRow}>
          <button
            type="button"
            onClick={handleSelectAll}
            style={styles.quickAllBtn}
            data-testid="stock-confirm-all-btn"
          >
            <PackageCheck size={16} />
            {actionNoun} total ({lineasConPendiente.reduce((acc, l) => acc + l.pendiente, 0)} u. restantes)
          </button>

          <div style={styles.fechaContainer}>
            <label style={styles.label}>Fecha del movimiento:</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={styles.dateInput}
              data-testid="stock-confirm-fecha"
            />
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
    padding: "6px 0",
  },
  instruction: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
    lineHeight: 1.4,
  },
  lineasContainer: {
    display: "flex",
    flexDirection: "column" as const,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    overflow: "hidden",
  },
  lineasHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 12px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  lineaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    gap: 12,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  lineaInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  lineaNombre: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lineaStats: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  lineaAction: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  numberInput: {
    width: 64,
    height: 36,
    textAlign: "center" as const,
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
  },
  btnTodo: {
    height: 36,
    padding: "0 8px",
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
  },
  badgeCompleto: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.SUCCESS,
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  quickAllBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.BUTTON.PRIMARY.BACKGROUND,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 0",
  },
  fechaContainer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  label: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  dateInput: {
    height: 36,
    padding: "0 8px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
  },
};
