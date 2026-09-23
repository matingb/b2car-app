"use client";

import React from "react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { formatMoney } from "./lineaUtils";
import { useInlineEditorContext } from "./InlineEditorContext";
import LineaCardShell from "./LineaCardShell";
import RepuestoEditableFields from "../repuestos/RepuestoEditableFields";

export type EditableLineaDraft = {
  qty: string;
  unit: string;
  purchaseUnit?: string;
};

type Props = {
  top: React.ReactNode;
  draft: EditableLineaDraft;
  onDraftChange: (patch: Partial<EditableLineaDraft>) => void;
  showPurchaseUnit?: boolean;
  selectors?: React.ReactNode;
  extra?: React.ReactNode;
};

export default function EditableLineaCard({
  top,
  draft,
  onDraftChange,
  showPurchaseUnit = false,
  selectors,
  extra,
}: Props) {
  const { kind, mode, validation, interactionEnabled, submitting, onConfirm, onCancel } =
    useInlineEditorContext();

  const qty = safeInt(draft.qty);
  const unit = safeNumber(draft.unit);
  const totalText = formatMoney(qty * unit);

  const confirmEnabled = interactionEnabled && validation.ok && !submitting;
  const cancelEnabled = interactionEnabled && !submitting;

  const confirmTitle =
    !validation.ok && validation.message
      ? validation.message
      : mode === "add"
      ? "Agregar"
      : "Guardar";

  const confirmAriaLabel =
    mode === "add"
      ? `agregar ${kind === "servicios" ? "servicio" : "repuesto"}`
      : "guardar cambios";
  const cancelAriaLabel =
    mode === "add"
      ? `cancelar agregar ${kind === "servicios" ? "servicio" : "repuesto"}`
      : "descartar cambios";

  return (
    <LineaCardShell
      kind={kind}
      isEditing={true}
      total={totalText}
      submitting={submitting}
      canConfirm={confirmEnabled}
      canCancel={cancelEnabled}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmTitle={confirmTitle}
      confirmAriaLabel={confirmAriaLabel}
      cancelAriaLabel={cancelAriaLabel}
      selectors={selectors}
      extra={extra}
    >
      <RepuestoEditableFields
        searchSlot={top}
        cantidad={draft.qty}
        precioCompra={draft.purchaseUnit}
        precioVenta={draft.unit}
        showPurchaseUnit={showPurchaseUnit}
        canInteract={interactionEnabled}
        onCantidadChange={(qty) => onDraftChange({ qty })}
        onPrecioCompraChange={(purchaseUnit) => onDraftChange({ purchaseUnit })}
        onPrecioVentaChange={(unit) => onDraftChange({ unit })}
      />
    </LineaCardShell>
  );
}
