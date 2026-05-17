"use client";

import React, { useMemo } from "react";
import { Plus, Package } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeInt, safeNumber } from "@/lib/numbers";
import { COLOR } from "@/theme/theme";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useInventario } from "@/app/providers/InventarioProvider";
import LineasSectionShell from "@/app/components/arreglos/lineas/shared/LineasSectionShell";
import { styles } from "@/app/components/arreglos/lineas/shared/lineaStyles";
import { useInlineEditor } from "@/app/components/arreglos/lineas/shared/useInlineEditor";
import { InlineEditorProvider } from "@/app/components/arreglos/lineas/shared/InlineEditorContext";
import ConflictWarning from "@/app/components/arreglos/lineas/shared/ConflictWarning";
import EditableLineaCard from "@/app/components/arreglos/lineas/shared/EditableLineaCard";
import NewProductLineaCard from "@/app/components/arreglos/lineas/shared/NewProductLineaCard";
import NewProductBadge from "@/app/components/arreglos/lineas/repuestos/NewProductBadge";
import NewProductFields from "@/app/components/arreglos/lineas/repuestos/NewProductFields";
import ReadOnlyLineaCard from "@/app/components/arreglos/lineas/shared/ReadOnlyLineaCard";
import StockPurchaseHint from "@/app/components/arreglos/lineas/repuestos/StockPurchaseHint";
import {
  NEW_PRODUCT_VALUE,
  applyStockSelection,
  computeStockState,
  getNewProductConflictMessage,
  validateRepuestoDraft,
} from "@/app/components/arreglos/lineas/repuestos/repuestoValidator";

export type RepuestoLinea = {
  id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  precioCompra?: number;
  tipo?: "existente" | "nuevo";
  producto?: { nombre?: string; codigo?: string | null } | null;
  nuevoProducto?: {
    codigo: string;
    nombre: string;
    precioCompra: number;
    precioVenta: number;
  };
};

export type RepuestoDraft = {
  stockId: string;
  cantidad: string;
  montoUnitario: string;
  codigo: string;
  nombre: string;
  precioCompra: string;
  precioVenta: string;
  precioVentaTouched: boolean;
};

export type RepuestoUpsertInput =
  | {
      tipo?: "existente";
      stock_id: string;
      cantidad: number;
      monto_unitario: number;
      precio_compra?: number;
    }
  | {
      id?: string;
      tipo: "nuevo";
      codigo: string;
      nombre: string;
      precio_compra: number;
      precio_venta: number;
      cantidad: number;
      monto_unitario: number;
    };

type Props = {
  title?: string;
  emptyText?: string;
  tallerId: string | null;
  items: RepuestoLinea[];
  disabled?: boolean;
  onUpsert: (input: RepuestoUpsertInput) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

export default function RepuestoLineasEditableSection({
  title = "Repuestos",
  emptyText = "Sin repuestos asignados.",
  tallerId,
  items,
  disabled = false,
  onUpsert,
  onDelete,
}: Props) {
  const { inventario, isLoading } = useInventario(tallerId ?? undefined);

  const subtotalValue = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.monto_unitario) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () => formatArs(subtotalValue, { maxDecimals: 0, minDecimals: 0 }),
    [subtotalValue]
  );

  const stockOptions: AutocompleteOption[] = useMemo(() => {
    return [
      {
        value: NEW_PRODUCT_VALUE,
        label: "Nuevo producto",
        secondaryLabel: "Crear producto, stock, compra y asignacion",
        icon: <Plus size={14} />,
      },
      ...(inventario ?? []).map((s) => ({
        value: s.id,
        label: s.nombre,
        secondaryLabel: `${s.codigo || ""}${s.codigo ? " · " : ""}Stock: ${Number(s.stockActual) || 0}`,
      })),
    ];
  }, [inventario]);

  const conflictMessageFor = (codigo: string, currentItemId?: string) =>
    getNewProductConflictMessage(codigo, { items, inventario }, currentItemId);

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
  } = useInlineEditor<RepuestoLinea, RepuestoDraft, RepuestoUpsertInput>({
    items,
    getId: (i) => i.id,
    initialDraft: { stockId: "", cantidad: "1", montoUnitario: "", codigo: "", nombre: "", precioCompra: "", precioVenta: "", precioVentaTouched: false },
    draftFromItem: (item) => {
      const stockMatch = item.tipo !== "nuevo" ? inventario.find((s) => s.id === item.stock_id) ?? null : null;
      const costoUnitarioPrefill = stockMatch ? String(Number(stockMatch.costoUnitario) || 0) : "";
      return {
        stockId: item.stock_id,
        cantidad: String(item.cantidad ?? 1),
        montoUnitario: String(item.monto_unitario ?? ""),
        codigo: item.nuevoProducto?.codigo ?? "",
        nombre: item.nuevoProducto?.nombre ?? "",
        precioCompra: item.nuevoProducto?.precioCompra != null
          ? String(item.nuevoProducto.precioCompra)
          : costoUnitarioPrefill,
        precioVenta: item.nuevoProducto?.precioVenta != null ? String(item.nuevoProducto.precioVenta) : "",
        precioVentaTouched: item.nuevoProducto
          ? Number(item.nuevoProducto.precioVenta ?? 0) !== Number(item.nuevoProducto.precioCompra ?? 0)
          : false,
      };
    },
    validate: (d, ctx) => validateRepuestoDraft(d, ctx, { tallerId, items, inventario }),
    onAdd: (value) => onUpsert(value),
    onUpdate: (id, value) => onUpsert(value.tipo === "nuevo" ? { ...value, id } : value),
  });

  const canInteract = !disabled && !submitting;

  const findStock = (stockId: string) => inventario.find((s) => s.id === stockId) ?? null;

  const updateDraft = (patch: Partial<RepuestoDraft>) => setDraft((p) => ({ ...p, ...patch }));

  const renderEditor = (item: RepuestoLinea | null) => {
    const stockState = computeStockState(item, draft, items, inventario);
    const validation = validateCurrent();
    const newProductConflict = stockState.isNewProduct
      ? conflictMessageFor(draft.codigo, item?.id)
      : null;
    const newProductQty = safeInt(draft.cantidad);

    const extraHint = submitting ? undefined
      : stockState.hasExistingRepuestoConflict ? (
        <ConflictWarning message="El repuesto ya se encuentra en el arreglo" />
      ) : stockState.hasStockIssue ? (
        <StockPurchaseHint
          stockActual={stockState.stockActual}
          faltante={stockState.faltante}
          precioCompra={safeNumber(draft.precioCompra)}
        />
      ) : stockState.isNewProduct && !newProductConflict && newProductQty > 0 ? (
        <StockPurchaseHint
          stockActual={0}
          faltante={newProductQty}
          precioCompra={safeNumber(draft.precioCompra)}
        />
      ) : undefined;

    const card = stockState.isNewProduct ? (
      <NewProductLineaCard
        top={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      })
                  : undefined
              }
            />
            <NewProductFields
              codigo={draft.codigo}
              nombre={draft.nombre}
              conflictMessage={submitting ? null : conflictMessageFor(draft.codigo, item?.id)}
              onCodigoChange={(v) => updateDraft({ codigo: v })}
              onNombreChange={(v) => updateDraft({ nombre: v })}
              disabled={!canInteract || !tallerId}
            />
          </div>
        }
        draft={{
          qty: draft.cantidad,
          purchaseUnit: draft.precioCompra,
          saleUnit: draft.precioVenta,
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
            placeholder={isLoading ? "Cargando inventario..." : "Buscar producto..."}
            disabled={stockState.mode === "edit" || !tallerId || isLoading || !canInteract}
            style={{ width: "100%" }}
          />
        }
        draft={{
          qty: draft.cantidad,
          unit: draft.montoUnitario,
          purchaseUnit: draft.precioCompra,
        }}
        onDraftChange={(patch) => {
          const next: Partial<RepuestoDraft> = {};
          if (patch.qty !== undefined) next.cantidad = patch.qty;
          if (patch.unit !== undefined) next.montoUnitario = patch.unit;
          if (patch.purchaseUnit !== undefined) next.precioCompra = patch.purchaseUnit;
          updateDraft(next);
        }}
        showPurchaseUnit={stockState.showPurchaseField}
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
        onConfirm={save}
        onCancel={cancel}
      >
        {card}
      </InlineEditorProvider>
    );
  };

  return (
    <LineasSectionShell
      title={title}
      titleIcon={<Package size={18} />}
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
            const code = item.nuevoProducto?.codigo ?? item.producto?.codigo ?? null;
            const titleText =
              item.nuevoProducto?.nombre ||
              item.producto?.nombre ||
              findStock(item.stock_id)?.nombre ||
              "Producto";
            return (
              <ReadOnlyLineaCard
                key={item.id}
                kind="repuestos"
                title={titleText}
                subtitle={
                  code ? (
                    <span style={styles.itemSubTitleCode}>
                      {`• ${code}`}
                    </span>
                  ) : undefined
                }
                cantidad={Number(item.cantidad) || 0}
                unitario={Number(item.monto_unitario) || 0}
                onEdit={() => startEdit(item)}
                onDelete={() => onDelete(item.id)}
                canInteract={canInteract && !isEditing && !!tallerId}
              />
            );
          }
          return <div key={item.id}>{renderEditor(item)}</div>;
        })}

        {adding ? (
          renderEditor(null)
        ) : (
          <button
            type="button"
            style={styles.addRowBtn}
            onClick={startAdd}
            disabled={!canInteract || isEditing || !tallerId}
            title={!tallerId ? "No hay taller asociado" : undefined}
          >
            <Plus size={18} />
            Agregar Repuesto
          </button>
        )}
      </div>
    </LineasSectionShell>
  );
}
