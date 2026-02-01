"use client";

import React, { useMemo } from "react";
import { Check, Plus, Trash2, X, Pencil, Wrench } from "lucide-react";
import { formatArs } from "@/lib/format";
import { COLOR } from "@/theme/theme";
import LineasSectionShell from "./LineasSectionShell";
import { itemIconCircleStyle, styles } from "./lineaStyles";
import { useInlineEditor } from "./useInlineEditor";

export type ServicioLinea = {
  id: string;
  descripcion: string;
  cantidad: number;
  valor: number;
};

type Draft = {
  descripcion: string;
  cantidad: string;
  valor: string;
};

type Props = {
  title?: string;
  emptyText?: string;
  items: ServicioLinea[];
  disabled?: boolean;
  onAdd: (input: { descripcion: string; cantidad: number; valor: number }) => void | Promise<void>;
  onUpdate: (id: string, patch: { descripcion: string; cantidad: number; valor: number }) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

function safeInt(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ServicioLineasEditableSection({
  title = "Mano de Obra",
  emptyText = "Sin servicios realizados.",
  items,
  disabled = false,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const {
    editingId,
    adding,
    isEditing,
    draft,
    setDraft,
    submitting,
    submitError,
    startAdd,
    startEdit,
    cancel,
    save,
    validateCurrent,
  } = useInlineEditor<ServicioLinea, Draft, { descripcion: string; cantidad: number; valor: number }>({
    items,
    getId: (i) => i.id,
    initialDraft: { descripcion: "", cantidad: "1", valor: "" },
    draftFromItem: (item) => ({
      descripcion: item.descripcion ?? "",
      cantidad: String(item.cantidad ?? 1),
      valor: String(item.valor ?? ""),
    }),
    validate: (d) => {
      const descripcion = d.descripcion.trim();
      const cantidad = safeInt(d.cantidad);
      const valor = safeMoney(d.valor);
      if (!descripcion) return { ok: false as const, message: "Falta descripción" };
      if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false as const, message: "Cantidad inválida" };
      if (!Number.isFinite(valor) || valor <= 0) return { ok: false as const, message: "Valor inválido" };
      return { ok: true as const, value: { descripcion, cantidad, valor } };
    },
    onAdd,
    onUpdate: (id, value) => onUpdate(id, value),
  });

  const subtotalValue = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.valor) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () => formatArs(subtotalValue, { maxDecimals: 0, minDecimals: 0 }),
    [subtotalValue]
  );

  const canInteract = !disabled && !submitting;

  const formatMoney = (n: number) =>
    formatArs(n, { maxDecimals: 0, minDecimals: 0 });

  const renderQtyXUnit = (cantidad: number, unitario: number) =>
    `${cantidad} x ${formatMoney(unitario)}`;

  const confirmBtnStyle = (enabled: boolean): React.CSSProperties => ({
    ...styles.confirmBtn,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  });

  const cancelBtnStyle = (enabled: boolean): React.CSSProperties => ({
    ...styles.cancelBtn,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  });

  return (
    <LineasSectionShell
      title={title}
      titleIcon={<Wrench size={18} />}
      subtotal={subtotal}
    >
      <div style={styles.list}>
        {submitError ? (
          <div style={{ color: COLOR.ICON.DANGER, fontWeight: 700, fontSize: 13 }}>
            {submitError}
          </div>
        ) : null}

        {items.length === 0 && !adding ? (
          <div style={styles.emptyState}>{emptyText}</div>
        ) : null}

        {items.map((item) => {
          const total = (Number(item.cantidad) || 0) * (Number(item.valor) || 0);
          const isRowEditing = editingId === item.id;

          if (!isRowEditing) {
            return (
              <div key={item.id} style={styles.itemCard}>
                <div style={itemIconCircleStyle("servicios")}>
                  <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>

                <div style={styles.itemMain}>
                  <div style={styles.itemTitle}>{item.descripcion || "Sin nombre"}</div>
                  <div style={styles.itemSubTitle}>
                    {renderQtyXUnit(item.cantidad, item.valor)}
                  </div>
                </div>

                <div style={styles.itemTotal}>{formatMoney(total)}</div>

                <button
                  type="button"
                  style={styles.actionBtn}
                  aria-label="editar servicio"
                  onClick={() => startEdit(item)}
                  disabled={!canInteract || isEditing}
                >
                  <Pencil size={18} color={COLOR.ICON.MUTED} />
                </button>

                <button
                  type="button"
                  style={styles.actionBtn}
                  aria-label="eliminar servicio"
                  onClick={() => onDelete(item.id)}
                  disabled={!canInteract || isEditing}
                >
                  <Trash2 size={18} color={COLOR.ICON.DANGER} />
                </button>
              </div>
            );
          }

          const parsed = validateCurrent();
          const totalDraft =
            safeInt(draft.cantidad) * safeMoney(draft.valor);
          const editorGridWithTotal: React.CSSProperties = {
            ...styles.editorGrid,
            gridTemplateColumns: "minmax(200px, 1fr) 72px 120px 110px",
          };

          return (
            <div key={item.id} style={{ ...styles.itemCard, gap: 10 }}>
              <div style={itemIconCircleStyle("servicios")}>
                <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
              </div>

              <div style={editorGridWithTotal}>
                <input
                  style={styles.editorInput}
                  value={draft.descripcion}
                  onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej: Cambio de aceite"
                  disabled={!canInteract}
                />
                <input
                  style={{ ...styles.editorInput, ...styles.editorInputRight }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.cantidad}
                  onChange={(e) => setDraft((p) => ({ ...p, cantidad: e.target.value.replace(/\D/g, "") }))}
                  placeholder="1"
                  disabled={!canInteract}
                  aria-label="Cantidad"
                />
                <input
                  style={{ ...styles.editorInput, ...styles.editorInputRight }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.valor}
                  onChange={(e) => setDraft((p) => ({ ...p, valor: e.target.value.replace(/\D/g, "") }))}
                  placeholder="0"
                  disabled={!canInteract}
                  aria-label="Valor unitario"
                />
                <div style={styles.itemTotal}>{formatMoney(totalDraft)}</div>
              </div>

              <button
                type="button"
                style={confirmBtnStyle(canInteract && parsed.ok)}
                aria-label="guardar cambios"
                onClick={() => void save()}
                disabled={!canInteract || !parsed.ok}
                title={!parsed.ok ? parsed.message : "Guardar"}
              >
                <Check size={18} color={COLOR.SEMANTIC.SUCCESS} />
              </button>
              <button
                type="button"
                style={cancelBtnStyle(canInteract)}
                aria-label="descartar cambios"
                onClick={cancel}
                disabled={!canInteract}
                title="Cancelar"
              >
                <X size={18} color={COLOR.ICON.DANGER} />
              </button>
            </div>
          );
        })}

        {adding ? (
          (() => {
            const parsed = validateCurrent();
            const totalDraft = safeInt(draft.cantidad) * safeMoney(draft.valor);
            const editorGridWithTotal: React.CSSProperties = {
              ...styles.editorGrid,
              gridTemplateColumns: "minmax(200px, 1fr) 72px 120px 110px",
            };
            return (
              <div style={{ ...styles.itemCard, gap: 10 }}>
                <div style={itemIconCircleStyle("servicios")}>
                  <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>

                <div style={editorGridWithTotal}>
                  <input
                    style={styles.editorInput}
                    value={draft.descripcion}
                    onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Cambio de aceite"
                    disabled={!canInteract}
                  />
                  <input
                    style={{ ...styles.editorInput, ...styles.editorInputRight }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.cantidad}
                    onChange={(e) => setDraft((p) => ({ ...p, cantidad: e.target.value.replace(/\D/g, "") }))}
                    placeholder="1"
                    disabled={!canInteract}
                    aria-label="Cantidad"
                  />
                  <input
                    style={{ ...styles.editorInput, ...styles.editorInputRight }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.valor}
                    onChange={(e) => setDraft((p) => ({ ...p, valor: e.target.value.replace(/\D/g, "") }))}
                    placeholder="0"
                    disabled={!canInteract}
                    aria-label="Valor unitario"
                  />
                  <div style={styles.itemTotal}>{formatMoney(totalDraft)}</div>
                </div>

                <button
                  type="button"
                  style={confirmBtnStyle(canInteract && parsed.ok)}
                  aria-label="agregar servicio"
                  onClick={() => void save()}
                  disabled={!canInteract || !parsed.ok}
                  title={!parsed.ok ? parsed.message : "Agregar"}
                >
                  <Check size={18} color={COLOR.SEMANTIC.SUCCESS} />
                </button>
                <button
                  type="button"
                  style={cancelBtnStyle(canInteract)}
                  aria-label="cancelar agregar servicio"
                  onClick={cancel}
                  disabled={!canInteract}
                  title="Cancelar"
                >
                  <X size={18} color={COLOR.ICON.DANGER} />
                </button>
              </div>
            );
          })()
        ) : (
          <button
            type="button"
            style={styles.addRowBtn}
            onClick={startAdd}
            disabled={!canInteract || isEditing}
          >
            <Plus size={18} />
            Agregar Mano de Obra
          </button>
        )}
      </div>
    </LineasSectionShell>
  );
}

