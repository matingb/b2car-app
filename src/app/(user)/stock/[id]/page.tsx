"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import type { StockItem } from "@/model/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import IconButton from "@/app/components/ui/IconButton";
import { Pencil, Save, Trash, X } from "lucide-react";
import StockLevelsCard from "@/app/components/stock/StockLevelsCard";
import MovementsCard from "@/app/components/inventario/MovementsCard";
import ProductoInfoCard from "@/app/components/productos/ProductoInfoCard";
import ProductoPricesCard from "@/app/components/productos/ProductoPricesCard";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { ROUTES } from "@/routing/routes";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useTenant } from "@/app/providers/TenantProvider";

export default function StockDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { talleres } = useTenant();
  const { productos, stockRegistros, updateStock, removeStock, updateProducto, categoriasDisponibles, loading } = useInventario();
  const { confirm } = useModalMessage();
  const { success } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StockItem | null>(null);

  const stock = useMemo(
    () => stockRegistros.find((s) => s.id === params.id) ?? null,
    [stockRegistros, params.id]
  );
  const producto = useMemo(() => {
    if (!stock) return null;
    return productos.find((p) => p.productoId === stock.productoId) ?? null;
  }, [productos, stock]);

  const item = useMemo<StockItem | null>(() => {
    if (!stock || !producto) return null;
    return {
      id: stock.id,
      productoId: stock.productoId,
      tallerId: stock.tallerId,
      nombre: producto.nombre,
      codigo: producto.codigo,
      categorias: producto.categorias,
      stockActual: stock.stockActual,
      stockMinimo: stock.stockMinimo,
      stockMaximo: stock.stockMaximo,
      precioCompra: producto.precioCompra,
      precioVenta: producto.precioVenta,
      proveedor: producto.proveedor,
      ubicacion: producto.ubicacion,
      ultimaActualizacion: stock.ultimaActualizacion,
      historialMovimientos: stock.historialMovimientos,
    };
  }, [producto, stock]);

  useEffect(() => {
    if (!item) {
      setDraft(null);
      setIsEditing(false);
      return;
    }
    setDraft({ ...item });
    setIsEditing(false);
  }, [item]);

  const title = useMemo(() => item?.nombre ?? "Detalle", [item?.nombre]);
  const tallerNombre = useMemo(() => {
    if (!item?.tallerId) return "";
    return talleres.find((t) => t.id === item.tallerId)?.nombre ?? item.tallerId;
  }, [item?.tallerId, talleres]);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    const ok = await confirm({
      title: "Eliminar stock",
      message: `¿Eliminar el stock de "${item.nombre}" en ${tallerNombre}?`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    await removeStock(item.id);
    success("Éxito", "El stock fue eliminado.");
    router.push(ROUTES.stock);
  }, [confirm, item, removeStock, router, success, tallerNombre]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    // Persistir cambios de producto (global) + stock (por taller)
    await updateProducto(draft.productoId, {
      nombre: draft.nombre,
      codigo: draft.codigo,
      proveedor: draft.proveedor,
      ubicacion: draft.ubicacion,
      precioCompra: draft.precioCompra,
      precioVenta: draft.precioVenta,
      categorias: draft.categorias,
    });
    await updateStock(draft.id, {
      stockActual: draft.stockActual,
      stockMinimo: draft.stockMinimo,
      stockMaximo: draft.stockMaximo,
    });
    setIsEditing(false);
    success("Éxito", "Cambios guardados.");
  }, [draft, success, updateProducto, updateStock]);

  if (loading && !item) {
    return (
      <div>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (!item || !draft) {
    return (
      <div>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16 }}>Item no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div css={styles.headerRow}>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton style={{ width: "100%" }} />
        <div style={styles.actions}>
          {isEditing ? (
            <>
              <IconButton
                icon={<X />}
                onClick={() => {
                  setDraft({ ...item });
                  setIsEditing(false);
                }}
                title="Cancelar"
                ariaLabel="Cancelar"
              />
              <IconButton icon={<Save />} onClick={handleSave} title="Guardar" ariaLabel="Guardar" />
            </>
          ) : (
            <>
              <IconButton
                icon={<Trash />}
                onClick={handleDelete}
                title="Eliminar"
                ariaLabel="Eliminar"
                hoverColor={COLOR.ICON.DANGER}
              />
              <IconButton
                icon={<Pencil />}
                onClick={() => setIsEditing(true)}
                title="Editar"
                ariaLabel="Editar"
              />
            </>
          )}
        </div>
      </div>

      <div style={styles.titleBlock}>
        {isEditing ? (
          <input
            style={styles.titleInput}
            value={draft.nombre}
            onChange={(e) => setDraft((p) => (p ? { ...p, nombre: e.target.value } : p))}
          />
        ) : (
          <h2 style={styles.title}>{title}</h2>
        )}
        <div style={styles.code}>
          {item.codigo} · {tallerNombre}
        </div>
      </div>

      <div css={styles.grid}>
        <div style={styles.leftCol}>
          <StockLevelsCard
            item={item}
            isEditing={isEditing}
            draft={draft}
            onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
          />
          <div style={{ marginTop: 12 }}>
            <MovementsCard movimientos={item.historialMovimientos} />
          </div>
        </div>

        <div style={styles.rightCol}>
          <ProductoInfoCard
            codigo={item.codigo}
            proveedor={item.proveedor}
            ubicacion={item.ubicacion}
            categorias={item.categorias}
            categoriasDisponibles={categoriasDisponibles}
            ultimaActualizacion={item.ultimaActualizacion}
            isEditing={isEditing}
            draft={{ codigo: draft.codigo, proveedor: draft.proveedor, ubicacion: draft.ubicacion, categorias: draft.categorias }}
            onChange={(patch) =>
              setDraft((p) => (p ? { ...p, ...patch } : p))
            }
          />
          <div style={{ marginTop: 12 }}>
            <ProductoPricesCard
              precioCompra={item.precioCompra}
              precioVenta={item.precioVenta}
              stockTotal={item.stockActual}
              isEditing={isEditing}
              draft={{ precioCompra: draft.precioCompra, precioVenta: draft.precioVenta }}
              onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  titleBlock: {
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
  },
  titleInput: {
    width: "100%",
    fontSize: 22,
    fontWeight: 800,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  code: {
    marginTop: 4,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  grid: css({
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  leftCol: { display: "flex", flexDirection: "column" as const, gap: 12 },
  rightCol: { display: "flex", flexDirection: "column" as const, gap: 12 },
} as const;

