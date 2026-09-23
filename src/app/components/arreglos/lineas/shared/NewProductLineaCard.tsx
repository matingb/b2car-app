"use client";

import React from "react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { formatMoney } from "./lineaUtils";
import { useInlineEditorContext } from "./InlineEditorContext";
import LineaCardShell from "./LineaCardShell";
import RepuestoEditableFields from "../repuestos/RepuestoEditableFields";

export type NewProductLineaDraft = {
  qty: string;
  purchaseUnit: string;
  saleUnit: string;
};

type Props = {
  header?: React.ReactNode;
  top: React.ReactNode;
  draft: NewProductLineaDraft;
  onDraftChange: (patch: Partial<NewProductLineaDraft>) => void;
  extra?: React.ReactNode;
};

export default function NewProductLineaCard({
  header,
  top,
  draft,
  onDraftChange,
  extra,
}: Props) {
  const { interactionEnabled, mode, submitting, onConfirm, onCancel, validation } =
    useInlineEditorContext();

  const qty = safeInt(draft.qty);
  const saleUnit = safeNumber(draft.saleUnit);
  const totalText = formatMoney(qty * saleUnit);

  const confirmEnabled = interactionEnabled && validation.ok && !submitting;
  const cancelEnabled = interactionEnabled && !submitting;

  return (
    <LineaCardShell
      kind="repuestos"
      isEditing={true}
      total={totalText}
      submitting={submitting}
      canConfirm={confirmEnabled}
      canCancel={cancelEnabled}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmAriaLabel={mode === "add" ? "agregar repuesto" : "guardar repuesto"}
      confirmTitle={
        !validation.ok && validation.message
          ? validation.message
          : mode === "add"
          ? "Agregar"
          : "Guardar"
      }
      cancelAriaLabel={mode === "add" ? "cancelar agregar repuesto" : "cancelar repuesto"}
      selectors={header}
      extra={extra}
    >
      <RepuestoEditableFields
        searchSlot={top}
        cantidad={draft.qty}
        precioCompra={draft.purchaseUnit}
        precioVenta={draft.saleUnit}
        showPurchaseUnit={true}
        canInteract={interactionEnabled}
        onCantidadChange={(qty) => onDraftChange({ qty })}
        onPrecioCompraChange={(purchaseUnit) => onDraftChange({ purchaseUnit })}
        onPrecioVentaChange={(saleUnit) => onDraftChange({ saleUnit })}
      />
    </LineaCardShell>
  );
}
