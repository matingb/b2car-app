"use client";

import React, { useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete, { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { AlertTriangle, Package, Wrench } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void | Promise<void>;
  arregloId: string;
  tallerId: string | null;
};

type Mode = "servicio" | "repuesto";

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ArregloItemModal({ open, onClose, onSubmitSuccess, arregloId, tallerId }: Props) {
  const { createDetalle, upsertRepuestoLinea, loading } = useArreglos();
  const { inventario, isLoading } = useInventario(tallerId ?? undefined);
  const { success, error } = useToast();

  const [mode, setMode] = useState<Mode>("servicio");

  // servicio
  const [descripcion, setDescripcion] = useState("");
  const [cantidadServicio, setCantidadServicio] = useState("1");
  const [valorServicio, setValorServicio] = useState("0");

  // repuesto
  const [stockId, setStockId] = useState("");
  const [cantidadRepuesto, setCantidadRepuesto] = useState("1");
  const [montoUnitario, setMontoUnitario] = useState("");

  const selectedStockItem = useMemo(() => {
    if (!stockId) return null;
    return inventario.find((s) => s.id === stockId) ?? null;
  }, [inventario, stockId]);

  const stockActual = selectedStockItem ? safeNumber(selectedStockItem.stockActual) : null;

  const productoOptions: AutocompleteOption[] = useMemo(() => {
    return (inventario ?? []).map((s) => ({
      value: s.id,
      label: s.nombre,
      secondaryLabel: `${s.codigo || ""}${s.codigo ? " · " : ""}Stock: ${safeNumber(s.stockActual)}`,
    }));
  }, [inventario]);

  const submitting = loading;

  const servicioCantidad = safeNumber(cantidadServicio);
  const servicioValor = safeNumber(valorServicio);

  const repuestoCantidad = safeNumber(cantidadRepuesto);
  const repuestoMontoUnitario = safeNumber(montoUnitario || selectedStockItem?.precioUnitario || 0);

  const repuestoSinStock = stockActual !== null && stockActual <= 0;
  const repuestoCantidadExcede = stockActual !== null && repuestoCantidad > stockActual;

  const isValid = useMemo(() => {
    if (!arregloId) return false;

    if (mode === "servicio") {
      return (
        descripcion.trim().length > 0 &&
        Number.isFinite(servicioCantidad) &&
        servicioCantidad > 0 &&
        Number.isFinite(servicioValor) &&
        servicioValor >= 0
      );
    }

    if (!tallerId) return false;
    if (!stockId) return false;
    if (!Number.isFinite(repuestoCantidad) || repuestoCantidad <= 0) return false;
    if (!Number.isFinite(repuestoMontoUnitario) || repuestoMontoUnitario < 0) return false;
    // permitir seleccionar, pero no permitir guardar si no hay stock suficiente
    if (repuestoSinStock || repuestoCantidadExcede) return false;
    return true;
  }, [
    arregloId,
    mode,
    descripcion,
    servicioCantidad,
    servicioValor,
    tallerId,
    stockId,
    repuestoCantidad,
    repuestoMontoUnitario,
    repuestoSinStock,
    repuestoCantidadExcede,
  ]);

  const resetAndClose = () => {
    setDescripcion("");
    setCantidadServicio("1");
    setValorServicio("0");
    setStockId("");
    setCantidadRepuesto("1");
    setMontoUnitario("");
    setMode("servicio");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      if (mode === "servicio") {
        await createDetalle(arregloId, {
          descripcion: descripcion.trim(),
          cantidad: servicioCantidad,
          valor: servicioValor,
        });
        success("Éxito", "Mano de obra agregada");
      } else {
        await upsertRepuestoLinea(arregloId, {
          taller_id: tallerId!,
          stock_id: stockId,
          cantidad: repuestoCantidad,
          monto_unitario: repuestoMontoUnitario,
        });
        success("Éxito", "Repuesto agregado");
      }

      await onSubmitSuccess();
      resetAndClose();
    } catch (err: unknown) {
      error("Error", err instanceof Error ? err.message : "No se pudo agregar el item");
    }
  };

  return (
    <Modal
      open={open}
      title="Agregar item"
      onClose={resetAndClose}
      onSubmit={handleSubmit}
      submitText="Agregar"
      submitting={submitting}
      disabledSubmit={!isValid}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div style={styles.modeRow}>
          <button
            type="button"
            onClick={() => setMode("servicio")}
            style={mode === "servicio" ? styles.modeBtnActive : styles.modeBtn}
          >
            <Wrench size={16} />
            Servicio
          </button>
          <button
            type="button"
            onClick={() => setMode("repuesto")}
            style={mode === "repuesto" ? styles.modeBtnActive : styles.modeBtn}
          >
            <Package size={16} />
            Repuesto
          </button>
        </div>

        {mode === "servicio" ? (
          <div style={{ marginTop: 12 }}>
            <div style={styles.field}>
              <label style={styles.label}>
                Descripción <span aria-hidden="true" style={styles.required}>*</span>
              </label>
              <input
                style={styles.input}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Cambio de aceite"
              />
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>
                  Cantidad <span aria-hidden="true" style={styles.required}>*</span>
                </label>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cantidadServicio}
                  onChange={(e) => setCantidadServicio(e.target.value.replace(/\D/g, ""))}
                  placeholder="1"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  Valor unitario <span aria-hidden="true" style={styles.required}>*</span>
                </label>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={valorServicio}
                  onChange={(e) => setValorServicio(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {!tallerId ? (
              <div style={styles.warnBox}>
                <AlertTriangle size={18} color={COLOR.ICON.DANGER} />
                <div>
                  <div style={{ fontWeight: 700 }}>No hay taller asociado</div>
                  <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                    Para agregar repuestos, el arreglo debe tener `taller_id`.
                  </div>
                </div>
              </div>
            ) : null}

            <div style={styles.field}>
              <label style={styles.label}>
                Producto <span aria-hidden="true" style={styles.required}>*</span>
              </label>
              <Autocomplete
                options={productoOptions}
                value={stockId}
                onChange={(v) => {
                  setStockId(v);
                  const found = inventario.find((s) => s.id === v);
                  if (found && montoUnitario.trim().length === 0) {
                    setMontoUnitario(String(safeNumber(found.precioUnitario) || 0));
                  }
                }}
                placeholder={isLoading ? "Cargando inventario..." : "Buscar producto..."}
                disabled={isLoading || !tallerId}
              />
              {selectedStockItem ? (
                <div style={{ marginTop: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                  Stock actual: <b>{safeNumber(selectedStockItem.stockActual)}</b>
                </div>
              ) : null}
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>
                  Cantidad <span aria-hidden="true" style={styles.required}>*</span>
                </label>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cantidadRepuesto}
                  onChange={(e) => setCantidadRepuesto(e.target.value.replace(/\D/g, ""))}
                  placeholder="1"
                  disabled={!tallerId}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  Precio unitario <span aria-hidden="true" style={styles.required}>*</span>
                </label>
                <input
                  style={styles.input}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={montoUnitario}
                  onChange={(e) => setMontoUnitario(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  disabled={!tallerId}
                />
              </div>
            </div>

            {selectedStockItem && (repuestoSinStock || repuestoCantidadExcede) ? (
              <div style={styles.warnBox}>
                <AlertTriangle size={18} color={COLOR.ICON.DANGER} />
                <div>
                  <div style={{ fontWeight: 700 }}>Stock insuficiente</div>
                  <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                    Podés seleccionar el producto, pero no se puede guardar con stock 0 o si la cantidad excede el stock.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  modeRow: {
    display: "flex",
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    cursor: "pointer",
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  },
  modeBtnActive: {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    background: COLOR.BACKGROUND.PRIMARY,
    cursor: "pointer",
    fontWeight: 800,
    color: COLOR.TEXT.PRIMARY,
  },
  row: {
    display: "flex",
    gap: 16,
    marginTop: 10,
  },
  field: { flex: 1, marginTop: 10 },
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
  warnBox: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  },
} as const;

