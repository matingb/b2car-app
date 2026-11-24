"use client";

import React, { useMemo } from "react";
import { Plus, Package } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeNumber } from "@/lib/numbers";
import { COLOR } from "@/theme/theme";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { buildStockAutocompleteOptions } from "@/app/components/stock/StockBreakdownBadge";
import { useInventario } from "@/app/providers/InventarioProvider";
import LineasSectionShell from "@/app/components/arreglos/lineas/shared/LineasSectionShell";
import { styles } from "@/app/components/arreglos/lineas/shared/lineaStyles";
import { useInlineEditor } from "@/app/components/arreglos/lineas/shared/useInlineEditor";
import ReadOnlyLineaCard from "@/app/components/arreglos/lineas/shared/ReadOnlyLineaCard";
import CategoriaChip from "@/app/components/arreglos/lineas/shared/CategoriaChip";
import EmpleadoChip from "@/app/components/arreglos/lineas/shared/EmpleadoChip";
import {
  NEW_PRODUCT_VALUE,
  validateRepuestoDraft,
} from "@/app/components/arreglos/lineas/repuestos/repuestoValidator";
import { useTenant } from "@/app/providers/TenantProvider";
import { Permission } from "@/lib/permissions";
import RepuestoEditor from "./RepuestoEditor";

export type RepuestoLinea = {
  id: string;
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  subtotal?: number;
  descuento?: number;
  total?: number;
  precioCompra?: number | null;
  tipo?: "existente" | "nuevo";
  producto?: { nombre?: string; codigo?: string | null } | null;
  nuevoProducto?: {
    codigo: string;
    nombre: string;
    precioCompra: number;
    precioVenta: number;
  };
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

export type RepuestoDraft = {
  stockId: string;
  cantidad: string;
  montoUnitario: string;
  descuento: string;
  codigo: string;
  nombre: string;
  precioCompra: string;
  precioVenta: string;
  precioVentaTouched: boolean;
  codigoTouched: boolean;
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

export type RepuestoUpsertInput =
  | {
      tipo?: "existente";
      linea_id?: string;
      stock_id: string;
      cantidad: number;
      monto_unitario: number;
      descuento?: number;
      precio_compra?: number | null;
      cuenta_financiera_id?: string | null;
      idempotency_key?: string | null;
      categoria_arreglo_id?: string | null;
      empleado_id?: string | null;
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
      descuento?: number;
      cuenta_financiera_id?: string | null;
      idempotency_key?: string | null;
      categoria_arreglo_id?: string | null;
      empleado_id?: string | null;
    };

type Props = {
  title?: string;
  emptyText?: string;
  tallerId: string | null;
  items: RepuestoLinea[];
  disabled?: boolean;
  readOnly?: boolean;
  deferred?: boolean;
  defaultCategoriaArregloId?: string | null;
  defaultEmpleadoId?: string | null;
  onUpsert: (input: RepuestoUpsertInput) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

export function calculateRepuestosSubtotal(items: RepuestoLinea[]): number {
  return items.reduce(
    (acc, i) =>
      acc +
      (i.total != null
        ? i.total
        : Math.max(
            0,
            (Number(i.cantidad) || 0) * (Number(i.monto_unitario) || 0) -
              (Number(i.descuento) || 0)
          )),
    0
  );
}

export default function RepuestoLineasEditableSection({
  title = "Repuestos",
  emptyText = "Sin repuestos asignados.",
  tallerId,
  items,
  disabled = false,
  readOnly = false,
  deferred = false,
  defaultCategoriaArregloId = null,
  defaultEmpleadoId = null,
  onUpsert,
  onDelete,
}: Props) {
  const { hasPermission } = useTenant();
  const canEditPrices = hasPermission(Permission.ArreglosPreciosEdit);
  const { inventario, isLoading } = useInventario(tallerId ?? undefined);

  const subtotalValue = useMemo(() => calculateRepuestosSubtotal(items), [items]);
  const subtotal = useMemo(
    () => formatArs(subtotalValue, { maxDecimals: 0, minDecimals: 0 }),
    [subtotalValue]
  );

  const stockOptions: AutocompleteOption[] = useMemo(() => {
    return buildStockAutocompleteOptions(inventario, {
      prependOptions: [
        {
          value: NEW_PRODUCT_VALUE,
          label: "Nuevo producto",
          secondaryLabel: "Crear producto, stock, compra y asignacion",
          icon: <Plus size={14} />,
        },
      ],
    });
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
  } = useInlineEditor<RepuestoLinea, RepuestoDraft, RepuestoUpsertInput>({
    items,
    getId: (i) => i.id,
    initialDraft: {
      stockId: "",
      cantidad: "1",
      montoUnitario: "",
      descuento: "0",
      codigo: "",
      nombre: "",
      precioCompra: "",
      precioVenta: "",
      precioVentaTouched: false,
      codigoTouched: false,
      categoriaArregloId: defaultCategoriaArregloId,
      empleadoId: defaultEmpleadoId,
    },
    draftFromItem: (item) => {
      const stockMatch = item.tipo !== "nuevo" ? inventario.find((s) => s.id === item.stock_id) ?? null : null;
      const costoUnitarioPrefill = stockMatch ? String(Number(stockMatch.costoUnitario) || 0) : "";
      return {
        // Los productos nuevos pendientes de un presupuesto no tienen stock_id todavía.
        stockId: item.tipo === "nuevo" ? NEW_PRODUCT_VALUE : item.stock_id,
        cantidad: String(item.cantidad ?? 1),
        montoUnitario: String(item.monto_unitario ?? ""),
        descuento: String(item.descuento ?? 0),
        codigo: item.nuevoProducto?.codigo ?? "",
        nombre: item.nuevoProducto?.nombre ?? "",
        precioCompra: item.nuevoProducto?.precioCompra != null
          ? String(item.nuevoProducto.precioCompra)
          : item.precioCompra != null
            ? String(item.precioCompra)
            : costoUnitarioPrefill,
        precioVenta: item.nuevoProducto?.precioVenta != null ? String(item.nuevoProducto.precioVenta) : "",
        precioVentaTouched: item.nuevoProducto
          ? Number(item.nuevoProducto.precioVenta ?? 0) !== Number(item.nuevoProducto.precioCompra ?? 0)
          : false,
        codigoTouched: true,
        categoriaArregloId: item.categoriaArregloId ?? null,
        empleadoId: item.empleadoId ?? null,
      };
    },
    validate: (d, ctx) => {
      const res = validateRepuestoDraft(d, ctx, { tallerId, items, inventario, deferred });
      if (!res.ok || canEditPrices) return res;

      return {
        ok: true,
        value:
          res.value.tipo === "nuevo"
            ? { ...res.value, precio_venta: 0, monto_unitario: 0 }
            : { ...res.value, monto_unitario: ctx.mode === "edit" ? safeNumber(ctx.item?.monto_unitario) : 0 },
      };
    },
    onAdd: (value) => onUpsert(value),
    onUpdate: (id, value) => onUpsert(value.tipo === "nuevo" ? { ...value, id } : { ...value, linea_id: id }),
    cancelWhen: readOnly,
  });

  const canInteract = !disabled && !readOnly && !submitting;

  const editorProps = {
    draft,
    setDraft,
    items,
    inventario,
    stockOptions,
    tallerId,
    isLoadingInventario: isLoading,
    canInteract,
    submitting,
    deferred,
    validation: validateCurrent(),
    onConfirm: save,
    onCancel: cancel,
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
            const stockMatch = inventario.find((s) => s.id === item.stock_id);
            const titleText =
              item.nuevoProducto?.nombre ||
              item.producto?.nombre ||
              stockMatch?.nombre ||
              "Producto";
            return (
              <ReadOnlyLineaCard
                key={item.id}
                kind="repuestos"
                title={
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{titleText}</span>
                    {code ? <span style={styles.itemSubTitleCode}>{code}</span> : null}
                  </div>
                }
                subtitle={
                  <>
                    <CategoriaChip categoriaArregloId={item.categoriaArregloId} />
                    <EmpleadoChip empleadoId={item.empleadoId} />
                  </>
                }
                cantidad={Number(item.cantidad) || 0}
                unitario={Number(item.monto_unitario) || 0}
                subtotal={item.subtotal}
                descuento={item.descuento}
                total={item.total}
                onEdit={() => startEdit(item)}
                onDelete={() => onDelete(item.id)}
                canInteract={canInteract && !isEditing && !!tallerId}
                readOnly={readOnly}
              />
            );
          }
          return (
            <div key={item.id}>
              <RepuestoEditor item={item} {...editorProps} />
            </div>
          );
        })}

        {adding ? (
          <RepuestoEditor item={null} {...editorProps} />
        ) : readOnly ? null : (
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
