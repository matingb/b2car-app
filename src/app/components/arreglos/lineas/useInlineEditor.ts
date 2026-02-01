"use client";

import { useMemo, useState } from "react";

type ValidationOk<TValue> = { ok: true; value: TValue };
type ValidationBad = { ok: false; message: string };
export type ValidationResult<TValue> = ValidationOk<TValue> | ValidationBad;

type Mode = "add" | "edit";

type Options<TItem, TDraft, TValue> = {
  items: TItem[];
  getId: (item: TItem) => string;
  initialDraft: TDraft;
  draftFromItem: (item: TItem) => TDraft;
  validate: (draft: TDraft, ctx: { mode: Mode; item?: TItem }) => ValidationResult<TValue>;
  onAdd: (value: TValue) => void | Promise<void>;
  onUpdate: (id: string, value: TValue, item: TItem) => void | Promise<void>;
};

export function useInlineEditor<TItem, TDraft, TValue>({
  items,
  getId,
  initialDraft,
  draftFromItem,
  validate,
  onAdd,
  onUpdate,
}: Options<TItem, TDraft, TValue>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TDraft>(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = !!editingId || adding;

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return items.find((i) => getId(i) === editingId) ?? null;
  }, [editingId, items, getId]);

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setSubmitError(null);
    setDraft(initialDraft);
  };

  const startEdit = (item: TItem) => {
    setAdding(false);
    setEditingId(getId(item));
    setSubmitError(null);
    setDraft(draftFromItem(item));
  };

  const cancel = () => {
    setEditingId(null);
    setAdding(false);
    setSubmitError(null);
    setDraft(initialDraft);
  };

  const validateCurrent = (): ValidationResult<TValue> => {
    const mode: Mode = adding ? "add" : "edit";
    return validate(draft, { mode, item: mode === "edit" ? (editingItem ?? undefined) : undefined });
  };

  const save = async () => {
    if (submitting) return;
    setSubmitError(null);

    const mode: Mode = adding ? "add" : "edit";
    const result = validateCurrent();
    if (!result.ok) return;

    setSubmitting(true);
    try {
      if (mode === "add") {
        await onAdd(result.value);
      } else {
        if (!editingId || !editingItem) return;
        await onUpdate(editingId, result.value, editingItem);
      }
      cancel();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return {
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
  };
}

