"use client";

import React, { useMemo } from "react";
import { Plus, Trash2, Pencil, Wrench } from "lucide-react";
import { formatArs } from "@/lib/format";
import { COLOR } from "@/theme/theme";
import LineasSectionShell from "./LineasSectionShell";
import { itemIconCircleStyle, styles } from "./lineaStyles";
import { useInlineEditor } from "./useInlineEditor";
import Card from "../../ui/Card";
import EditableLineaCard from "./EditableLineaCard";

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
              <Card key={item.id} style={styles.itemCard}>
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
              </Card>
            );
          }
          
          const parsed = validateCurrent();
          const descriptionStyle: React.CSSProperties = { ...styles.editorInput, width: "100%" };

          return (
            <div key={item.id}>
              <EditableLineaCard
                kind="servicios"
                mode="edit"
                top={
                  <input
                    style={descriptionStyle}
                    value={draft.descripcion}
                    onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Cambio de aceite"
                    disabled={!canInteract}
                  />
                }
                qtyValue={draft.cantidad}
                unitValue={draft.valor}
                onQtyChange={(v) => setDraft((p) => ({ ...p, cantidad: v }))}
                onUnitChange={(v) => setDraft((p) => ({ ...p, valor: v }))}
                interactionEnabled={canInteract}
                validation={parsed.ok ? { ok: true } : { ok: false, message: parsed.message }}
                onConfirm={save}
                onCancel={cancel}
              />
            </div>
          );
        })}

        {adding ? (
          (() => {
            const parsed = validateCurrent();
            const descriptionStyle: React.CSSProperties = { ...styles.editorInput, width: "100%" };
            return (
              <EditableLineaCard
                kind="servicios"
                mode="add"
                top={
                  <input
                    style={descriptionStyle}
                    value={draft.descripcion}
                    onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Cambio de aceite"
                    disabled={!canInteract}
                  />
                }
                qtyValue={draft.cantidad}
                unitValue={draft.valor}
                onQtyChange={(v) => setDraft((p) => ({ ...p, cantidad: v }))}
                onUnitChange={(v) => setDraft((p) => ({ ...p, valor: v }))}
                interactionEnabled={canInteract}
                validation={parsed.ok ? { ok: true } : { ok: false, message: parsed.message }}
                onConfirm={save}
                onCancel={cancel}
              />
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

