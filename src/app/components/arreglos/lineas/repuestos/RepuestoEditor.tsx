"use client";

import React from "react";
import { safeInt, safeNumber } from "@/lib/numbers";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { InlineEditorProvider } from "@/app/components/arreglos/lineas/shared/InlineEditorContext";
import EditableLineaCard from "@/app/components/arreglos/lineas/shared/EditableLineaCard";
import NewProductLineaCard from "@/app/components/arreglos/lineas/shared/NewProductLineaCard";
import NewProductBadge from "@/app/components/arreglos/lineas/repuestos/NewProductBadge";
import NewProductFields from "@/app/components/arreglos/lineas/repuestos/NewProductFields";
import CategoriaArregloSelect from "@/app/components/arreglos/lineas/shared/CategoriaArregloSelect";
import EmpleadoSelect from "@/app/components/arreglos/lineas/shared/EmpleadoSelect";
import { generateProductCode } from "@/app/components/arreglos/lineas/repuestos/repuestoCode";
import {
  applyStockSelection,
  computeStockState,
  getNewProductConflictMessage,
  type InventarioEntry,
} from "@/app/components/arreglos/lineas/repuestos/repuestoValidator";
import { resolveStockHint } from "./RepuestoStockHint";
import type { RepuestoDraft, RepuestoLinea } from "./RepuestoLineasEditableSection";

export type RepuestoEditorProps = {
  item: RepuestoLinea | null;
  draft: RepuestoDraft;
  setDraft: React.Dispatch<React.SetStateAction<RepuestoDraft>>;
  items: RepuestoLinea[];
  inventario: ReadonlyArray<InventarioEntry>;
  stockOptions: AutocompleteOption[];
  tallerId: string | null;
  isLoadingInventario?: boolean;
  canInteract: boolean;
  submitting: boolean;
  deferred?: boolean;
  validation: { ok: boolean; message?: string };
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function RepuestoEditor({
  item,
  draft,
  setDraft,
  items,
  inventario,
  stockOptions,
  tallerId,
  isLoadingInventario = false,
  canInteract,
  submitting,
  deferred = false,
  validation,
  onConfirm,
  onCancel,
}: RepuestoEditorProps) {
  const stockState = computeStockState(item, draft, items, inventario, deferred);
  const newProductConflict = stockState.isNewProduct
    ? getNewProductConflictMessage(draft.codigo, { items, inventario }, item?.id)
    : null;
  const newProductQty = safeInt(draft.cantidad);

  const extraHint = resolveStockHint({
    submitting,
    stockState,
    newProductConflict,
    newProductQty,
    precioCompra: safeNumber(draft.precioCompra),
    deferred,
  });

  const updateDraft = (patch: Partial<RepuestoDraft>) =>
    setDraft((p) => ({ ...p, ...patch }));

  const tipoEmpleadoSelectors = (
    <>
      <CategoriaArregloSelect
        value={draft.categoriaArregloId}
        onChange={(categoriaArregloId) => updateDraft({ categoriaArregloId })}
        disabled={!canInteract}
      />
      <EmpleadoSelect
        value={draft.empleadoId}
        onChange={(empleadoId) => updateDraft({ empleadoId })}
        disabled={!canInteract}
      />
    </>
  );

  const newProductHeader = (
    <>
      <NewProductBadge
        onClose={
          stockState.mode === "add"
            ? () =>
                updateDraft({
                  stockId: "",
                  codigo: "",
                  nombre: "",
                  precioCompra: "",
                  precioVenta: "",
                  precioVentaTouched: false,
                  codigoTouched: false,
                })
            : undefined
        }
      />
      {tipoEmpleadoSelectors}
    </>
  );

  const card = stockState.isNewProduct ? (
    <NewProductLineaCard
      header={newProductHeader}
      top={
        <NewProductFields
          codigo={draft.codigo}
          nombre={draft.nombre}
          conflictMessage={submitting ? null : newProductConflict}
          onCodigoChange={(v) => updateDraft({ codigo: v, codigoTouched: v.trim().length > 0 })}
          onNombreChange={(v) => {
            const patch: Partial<RepuestoDraft> = { nombre: v };
            if (!draft.codigoTouched) {
              patch.codigo = generateProductCode(v, { items, inventario });
            }
            updateDraft(patch);
          }}
          disabled={!canInteract || !tallerId}
        />
      }
      draft={{
        qty: draft.cantidad,
        purchaseUnit: draft.precioCompra,
        saleUnit: draft.precioVenta,
        descuento: draft.descuento,
      }}
      onDraftChange={(patch) => {
        setDraft((p) => {
          const next: RepuestoDraft = { ...p };
          if (patch.qty !== undefined) next.cantidad = patch.qty;
          if (patch.saleUnit !== undefined) {
            next.precioVenta = patch.saleUnit;
            next.precioVentaTouched = true;
          }
          if (patch.purchaseUnit !== undefined) {
            next.precioCompra = patch.purchaseUnit;
            if (!p.precioVentaTouched) next.precioVenta = patch.purchaseUnit;
          }
          if (patch.descuento !== undefined) {
            next.descuento = patch.descuento;
          }
          return next;
        });
      }}
      extra={extraHint}
    />
  ) : (
    <EditableLineaCard
      top={
        <Autocomplete
          options={stockOptions}
          value={draft.stockId}
          onChange={(v) => {
            if (stockState.mode === "edit") return;
            setDraft((p) => applyStockSelection(v, p, inventario));
          }}
          placeholder={isLoadingInventario ? "Cargando inventario..." : "Buscar producto..."}
          disabled={stockState.mode === "edit" || !tallerId || isLoadingInventario || !canInteract}
          style={{ width: "100%" }}
        />
      }
      draft={{
        qty: draft.cantidad,
        unit: draft.montoUnitario,
        purchaseUnit: draft.precioCompra,
        descuento: draft.descuento,
      }}
      onDraftChange={(patch) => {
        const next: Partial<RepuestoDraft> = {};
        if (patch.qty !== undefined) next.cantidad = patch.qty;
        if (patch.unit !== undefined) next.montoUnitario = patch.unit;
        if (patch.purchaseUnit !== undefined) next.precioCompra = patch.purchaseUnit;
        if (patch.descuento !== undefined) next.descuento = patch.descuento;
        updateDraft(next);
      }}
      showPurchaseUnit={stockState.showPurchaseField}
      selectors={tipoEmpleadoSelectors}
      extra={extraHint}
    />
  );

  return (
    <InlineEditorProvider
      kind="repuestos"
      mode={stockState.mode}
      submitting={submitting}
      interactionEnabled={canInteract && !!tallerId}
      validation={validation}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {card}
    </InlineEditorProvider>
  );
}
