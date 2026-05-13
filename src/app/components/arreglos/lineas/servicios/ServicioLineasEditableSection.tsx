"use client";

import React, { useMemo } from "react";
import { Plus, Wrench } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeInt, safeNumber } from "@/lib/numbers";
import { COLOR } from "@/theme/theme";
import LineasSectionShell from "@/app/components/arreglos/lineas/shared/LineasSectionShell";
import { styles } from "@/app/components/arreglos/lineas/shared/lineaStyles";
import { useInlineEditor } from "@/app/components/arreglos/lineas/shared/useInlineEditor";
import { InlineEditorProvider } from "@/app/components/arreglos/lineas/shared/InlineEditorContext";
import EditableLineaCard from "@/app/components/arreglos/lineas/shared/EditableLineaCard";
import ReadOnlyLineaCard from "@/app/components/arreglos/lineas/shared/ReadOnlyLineaCard";

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
      const valorRaw = d.valor.trim();
      const valor = valorRaw.length === 0 ? 0 : safeNumber(valorRaw);
      if (!descripcion) return { ok: false as const, message: "Falta descripción" };
      if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false as const, message: "Cantidad inválida" };
      if (!Number.isFinite(valor) || valor < 0) return { ok: false as const, message: "Valor inválido" };
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

  const renderEditor = (mode: "add" | "edit") => {
    const parsed = validateCurrent();
    const validation = parsed.ok ? { ok: true as const } : { ok: false as const, message: parsed.message };
    const descriptionStyle: React.CSSProperties = { ...styles.editorInput, width: "100%" };
    return (
      <InlineEditorProvider
        kind="servicios"
        mode={mode}
        submitting={submitting}
        interactionEnabled={canInteract}
        validation={validation}
        onConfirm={save}
        onCancel={cancel}
      >
        <EditableLineaCard
          top={
            <input
              style={descriptionStyle}
              value={draft.descripcion}
              onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Ej: Cambio de aceite"
              disabled={!canInteract}
            />
          }
          draft={{ qty: draft.cantidad, unit: draft.valor }}
          onDraftChange={(patch) =>
            setDraft((p) => ({
              ...p,
              ...(patch.qty !== undefined ? { cantidad: patch.qty } : {}),
              ...(patch.unit !== undefined ? { valor: patch.unit } : {}),
            }))
          }
        />
      </InlineEditorProvider>
    );
  };

  return (
    <LineasSectionShell
      title={title}
      titleIcon={<Wrench size={18} />}
      subtotal={subtotal}
      collapseDisabled={isEditing}
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
          if (editingId !== item.id) {
            return (
              <ReadOnlyLineaCard
                key={item.id}
                kind="servicios"
                title={item.descripcion || "Sin nombre"}
                cantidad={Number(item.cantidad) || 0}
                unitario={Number(item.valor) || 0}
                onEdit={() => startEdit(item)}
                onDelete={() => onDelete(item.id)}
                canInteract={canInteract && !isEditing}
              />
            );
          }
          return <div key={item.id}>{renderEditor("edit")}</div>;
        })}

        {adding ? (
          renderEditor("add")
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
