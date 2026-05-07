"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, Package } from "lucide-react";
import { formatArs } from "@/lib/format";
import { COLOR } from "@/theme/theme";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useInventario } from "@/app/providers/InventarioProvider";
import LineasSectionShell from "./LineasSectionShell";
import { itemIconCircleStyle, styles } from "./lineaStyles";
import { useInlineEditor } from "./useInlineEditor";
import EditableLineaCard from "./EditableLineaCard";
import Card from "../../ui/Card";

export type RepuestoLinea = {
  id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  tipo?: "existente" | "nuevo";
  producto?: { nombre?: string; codigo?: string | null } | null;
  nuevoProducto?: {
    codigo: string;
    nombre: string;
    precioCompra: number;
    precioVenta: number;
  };
};

type Draft = {
  stockId: string;
  cantidad: string;
  montoUnitario: string;
  codigo: string;
  nombre: string;
  precioCompra: string;
  precioVenta: string;
};

export type RepuestoUpsertInput =
  | { tipo?: "existente"; stock_id: string; cantidad: number; monto_unitario: number }
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

const NEW_PRODUCT_VALUE = "__nuevo_producto__";

function safeInt(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
  } = useInlineEditor<RepuestoLinea, Draft, RepuestoUpsertInput>({
    items,
    getId: (i) => i.id,
    initialDraft: { stockId: "", cantidad: "1", montoUnitario: "", codigo: "", nombre: "", precioCompra: "", precioVenta: "" },
    draftFromItem: (item) => ({
      stockId: item.stock_id,
      cantidad: String(item.cantidad ?? 1),
      montoUnitario: String(item.monto_unitario ?? ""),
      codigo: item.nuevoProducto?.codigo ?? "",
      nombre: item.nuevoProducto?.nombre ?? "",
      precioCompra: item.nuevoProducto?.precioCompra != null ? String(item.nuevoProducto.precioCompra) : "",
      precioVenta: item.nuevoProducto?.precioVenta != null ? String(item.nuevoProducto.precioVenta) : "",
    }),
    validate: (d, ctx) => {
      if (!tallerId) return { ok: false as const, message: "No hay taller asociado" };
      const stockId = String(d.stockId || "").trim();
      const cantidad = safeInt(d.cantidad);
      const montoUnitario = safeMoney(d.montoUnitario);
      if (!stockId) return { ok: false as const, message: "Falta producto" };
      if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false as const, message: "Cantidad inválida" };
      if (stockId === NEW_PRODUCT_VALUE) {
        const codigo = String(d.codigo ?? "").trim();
        const nombre = String(d.nombre ?? "").trim();
        const precioCompra = safeMoney(d.precioCompra);
        const precioVenta = safeMoney(d.precioVenta);
        if (!codigo) return { ok: false as const, message: "Falta código" };
        if (!nombre) return { ok: false as const, message: "Falta nombre" };
        if (!Number.isFinite(precioCompra) || precioCompra < 0) return { ok: false as const, message: "Precio de compra inválido" };
        if (!Number.isFinite(precioVenta) || precioVenta < 0) return { ok: false as const, message: "Precio de venta inválido" };
        const editingId = ctx.mode === "edit" && ctx.item ? ctx.item.id : null;
        if (items.some((i) => i.id !== editingId && i.tipo === "nuevo" && i.nuevoProducto?.codigo?.trim().toLowerCase() === codigo.toLowerCase())) {
          return { ok: false as const, message: "Ese código ya está agregado" };
        }
        if (items.some((i) => i.id !== editingId && i.tipo !== "nuevo" && i.producto?.codigo?.trim().toLowerCase() === codigo.toLowerCase())) {
          return { ok: false as const, message: "Ese código ya existe en repuestos" };
        }
        return {
          ok: true as const,
          value: {
            tipo: "nuevo",
            codigo,
            nombre,
            precio_compra: precioCompra,
            precio_venta: precioVenta,
            cantidad,
            monto_unitario: precioVenta,
          },
        };
      }
      if (!Number.isFinite(montoUnitario) || montoUnitario < 0) return { ok: false as const, message: "Monto inválido" };

      if (ctx.mode === "add" && items.some((i) => i.stock_id === stockId)) {
        return { ok: false as const, message: "Ese repuesto ya está agregado" };
      }

      const stock = inventario.find((s) => s.id === stockId) ?? null;
      if (!stock) return { ok: false as const, message: "Stock no encontrado" };

      const baseQty =
        ctx.mode === "edit" && ctx.item ? Number(ctx.item.cantidad) || 0 : 0;
      const delta = cantidad - baseQty;
      const stockActual = Number(stock.stockActual) || 0;
      if (delta > 0 && delta > stockActual) {
        return { ok: false as const, message: "Stock insuficiente" };
      }

      return { ok: true as const, value: { tipo: "existente", stock_id: stockId, cantidad, monto_unitario: montoUnitario } };
    },
    onAdd: (value) => onUpsert(value),
    onUpdate: (id, value) => onUpsert(value.tipo === "nuevo" ? { ...value, id } : value),
  });

  const canInteract = !disabled && !submitting;

  const findStock = (stockId: string) => inventario.find((s) => s.id === stockId) ?? null;

  const formatMoney = (n: number) =>
    formatArs(n, { maxDecimals: 0, minDecimals: 0 });

  const renderQtyXUnit = (cantidad: number, unitario: number) =>
    `${cantidad} x ${formatMoney(unitario)}`;

  const renderWarnNoTaller = !tallerId ? (
    <div style={styles.warnBox}>
      <AlertTriangle size={18} color={COLOR.ICON.DANGER} />
      <div>
        <div style={{ fontWeight: 700 }}>No hay taller asociado</div>
        <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
          Para agregar repuestos, el arreglo debe tener `taller_id`.
        </div>
      </div>
    </div>
  ) : null;

  return (
    <LineasSectionShell
      title={title}
      titleIcon={<Package size={18} />}
      subtotal={subtotal}
      collapseDisabled={isEditing}
    >
      <div style={styles.list}>
        {renderWarnNoTaller}
        {submitError ? (
          <div style={{ color: COLOR.ICON.DANGER, fontWeight: 700, fontSize: 13 }}>
            {submitError}
          </div>
        ) : null}

        {items.length === 0 && !adding ? (
          <div style={styles.emptyState}>{emptyText}</div>
        ) : null}

        {items.map((item) => {
          const total = (Number(item.cantidad) || 0) * (Number(item.monto_unitario) || 0);
          const isRowEditing = editingId === item.id;
          const code = item.nuevoProducto?.codigo ?? item.producto?.codigo ?? null;
          const titleText = item.nuevoProducto?.nombre || item.producto?.nombre || findStock(item.stock_id)?.nombre || "Producto";

          if (!isRowEditing) {
            return (
              <Card key={item.id} style={styles.itemCard}>
                <div style={itemIconCircleStyle("repuestos")}>
                  <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
                </div>

                <div style={styles.itemMain}>
                  <div style={styles.itemTitle}>
                    {titleText}
                    {code ? (
                      <span style={{ marginLeft: 8, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 }}>
                        {code}
                      </span>
                    ) : null}
                  </div>
                  <div style={styles.itemSubTitle}>
                    {renderQtyXUnit(item.cantidad, item.monto_unitario)}
                  </div>
                </div>

                <div style={styles.itemTotal}>{formatMoney(total)}</div>

                <button
                  type="button"
                  style={styles.actionBtn}
                  aria-label="editar repuesto"
                  onClick={() => startEdit(item)}
                  disabled={!canInteract || isEditing || !tallerId}
                >
                  <Pencil size={18} color={COLOR.ICON.MUTED} />
                </button>

                <button
                  type="button"
                  style={styles.actionBtn}
                  aria-label="eliminar repuesto"
                  onClick={() => onDelete(item.id)}
                  disabled={!canInteract || isEditing || !tallerId}
                >
                  <Trash2 size={18} color={COLOR.ICON.DANGER} />
                </button>
              </Card>
            );
          }

          const baseQty = Number(item.cantidad) || 0;
          const parsed = validateCurrent();
          const stock = findStock(item.stock_id);
          const stockActual = stock ? Number(stock.stockActual) || 0 : null;
          const delta = safeInt(draft.cantidad) - baseQty;
          const isNewProduct = item.tipo === "nuevo" || draft.stockId === NEW_PRODUCT_VALUE;
          const hasStockIssue = !isNewProduct && stockActual !== null && delta > 0 && delta > stockActual;
          const productStyle: React.CSSProperties = { width: "100%" };

          return (
            <div key={item.id}>
              <EditableLineaCard
                kind="repuestos"
                mode="edit"
                top={
                  <div style={{ display: "grid", gap: 8 }}>
                    <Autocomplete
                      options={stockOptions}
                      value={draft.stockId}
                      onChange={(v) => setDraft((p) => ({ ...p, stockId: v }))}
                      placeholder={isLoading ? "Cargando inventario..." : "Buscar producto..."}
                      disabled
                      style={productStyle}
                    />
                    {isNewProduct ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 8 }}>
                        <input
                          style={styles.editorInput}
                          value={draft.codigo}
                          onChange={(e) => setDraft((p) => ({ ...p, codigo: e.target.value }))}
                          placeholder="Codigo"
                          disabled={!canInteract}
                          aria-label="Codigo"
                        />
                        <input
                          style={styles.editorInput}
                          value={draft.nombre}
                          onChange={(e) => setDraft((p) => ({ ...p, nombre: e.target.value }))}
                          placeholder="Nombre"
                          disabled={!canInteract}
                          aria-label="Nombre"
                        />
                      </div>
                    ) : null}
                  </div>
                }
                qtyValue={draft.cantidad}
                unitValue={isNewProduct ? draft.precioVenta : draft.montoUnitario}
                purchaseUnitValue={draft.precioCompra}
                onQtyChange={(v) => setDraft((p) => ({ ...p, cantidad: v }))}
                onUnitChange={(v) => setDraft((p) => (isNewProduct ? { ...p, precioVenta: v } : { ...p, montoUnitario: v }))}
                onPurchaseUnitChange={(v) => setDraft((p) => ({ ...p, precioCompra: v }))}
                showPurchaseUnit={isNewProduct}
                interactionEnabled={canInteract && !!tallerId}
                validation={parsed.ok ? { ok: true } : { ok: false, message: parsed.message }}
                onConfirm={save}
                onCancel={cancel}
                extra={
                  hasStockIssue ? (
                    <div style={{ color: COLOR.ICON.DANGER, fontWeight: 700 }}>
                      Stock insuficiente
                    </div>
                  ) : null
                }
              />
            </div>
          );
        })}

        {adding ? (
          (() => {
            const parsed = validateCurrent();
            const stock = draft.stockId ? findStock(draft.stockId) : null;
            const baseQty = 0;
            const productStyle: React.CSSProperties = { width: "100%" };
            const isNewProduct = draft.stockId === NEW_PRODUCT_VALUE;
            const hasStockIssue = (() => {
              if (isNewProduct || !stock) return false;
              const delta = safeInt(draft.cantidad) - baseQty;
              const stockActual = Number(stock.stockActual) || 0;
              return delta > 0 && delta > stockActual;
            })();

            return (
              <EditableLineaCard
                kind="repuestos"
                mode="add"
                top={
                  <div style={{ display: "grid", gap: 8 }}>
                    <Autocomplete
                      options={stockOptions}
                      value={draft.stockId}
                      onChange={(v) => {
                        setDraft((p) => ({
                          ...p,
                          stockId: v,
                          montoUnitario: v === NEW_PRODUCT_VALUE ? "" : p.montoUnitario,
                          precioVenta: v === NEW_PRODUCT_VALUE ? p.precioVenta : "",
                          precioCompra: v === NEW_PRODUCT_VALUE ? p.precioCompra : "",
                        }));
                        const found = inventario.find((s) => s.id === v);
                        if (found && String(draft.montoUnitario || "").trim().length === 0) {
                          setDraft((p) => ({ ...p, montoUnitario: String(Number(found.precioUnitario) || 0) }));
                        }
                      }}
                      placeholder={isLoading ? "Cargando inventario..." : "Buscar producto..."}
                      disabled={!tallerId || isLoading || !canInteract}
                      style={productStyle}
                    />
                    {isNewProduct ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 8 }}>
                        <input
                          style={styles.editorInput}
                          value={draft.codigo}
                          onChange={(e) => setDraft((p) => ({ ...p, codigo: e.target.value }))}
                          placeholder="Codigo"
                          disabled={!canInteract}
                          aria-label="Codigo"
                        />
                        <input
                          style={styles.editorInput}
                          value={draft.nombre}
                          onChange={(e) => setDraft((p) => ({ ...p, nombre: e.target.value }))}
                          placeholder="Nombre"
                          disabled={!canInteract}
                          aria-label="Nombre"
                        />
                      </div>
                    ) : null}
                  </div>
                }
                qtyValue={draft.cantidad}
                unitValue={isNewProduct ? draft.precioVenta : draft.montoUnitario}
                purchaseUnitValue={draft.precioCompra}
                onQtyChange={(v) => setDraft((p) => ({ ...p, cantidad: v }))}
                onUnitChange={(v) => setDraft((p) => (isNewProduct ? { ...p, precioVenta: v } : { ...p, montoUnitario: v }))}
                onPurchaseUnitChange={(v) => setDraft((p) => ({ ...p, precioCompra: v }))}
                showPurchaseUnit={isNewProduct}
                interactionEnabled={canInteract && !!tallerId}
                validation={parsed.ok ? { ok: true } : { ok: false, message: parsed.message }}
                onConfirm={save}
                onCancel={cancel}
                extra={
                  hasStockIssue ? (
                    <div style={{ color: COLOR.ICON.DANGER, fontWeight: 700 }}>
                      Stock insuficiente
                    </div>
                  ) : null
                }
              />
            );
          })()
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

