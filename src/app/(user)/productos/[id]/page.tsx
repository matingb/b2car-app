"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTenant } from "@/app/providers/TenantProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import IconButton from "@/app/components/ui/IconButton";
import { Pencil, Save, Trash, X } from "lucide-react";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProductoInfoCard from "@/app/components/productos/ProductoInfoCard";
import ProductoPricesCard from "@/app/components/productos/ProductoPricesCard";
import ProductoStockMatrix from "@/app/components/productos/ProductoStockMatrix";
import Toggle from "@/app/components/ui/Toggle";
import {
  Producto,
  SaveProductoStockInput,
  SaveProductoStockResult,
  StockRegistro,
  useProductos,
} from "@/app/providers/ProductosProvider";
import { logger } from "@/lib/logger";

const Header = () => (
  <ScreenHeader
    title="Productos"
    breadcrumbs={["Detalle"]}
    hasBackButton
    style={{ width: "100%" }}
  />
);

export default function ProductoDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTallerId = searchParams.get("tallerId") ?? "";
  const { talleres } = useTenant();
  const {
    getProductoById,
    updateProducto,
    updateShowInStock,
    saveProductoStock,
    removeProductoStock,
    removeProducto,
    categoriasDisponibles,
    isLoading,
  } = useProductos();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [stockDelProducto, setStockDelProducto] = useState<StockRegistro[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Producto | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadProducto = useCallback(
    async (isCancelled?: () => boolean) => {
      const res = await getProductoById(params.id);
      if (isCancelled?.()) return;
      setProducto(res?.producto ?? null);
      setStockDelProducto(res?.stocks ?? []);
      logger.debug("Loaded producto details: ", res);
    },
    [getProductoById, params.id]
  );

  useEffect(() => {
    let cancelled = false;
    void loadProducto(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadProducto]);

  const stockTotal = useMemo(() => {
    return stockDelProducto.reduce((acc, s) => acc + (Number(s.stockActual) || 0), 0);
  }, [stockDelProducto]);

  const ultimaActualizacion = useMemo(() => {
    const toKey = (f: string) => {
      const [dd, mm, yyyy] = String(f ?? "").split("/");
      return `${yyyy ?? ""}${mm ?? ""}${dd ?? ""}`;
    };
    const fechas = stockDelProducto.map((s) => s.ultimaActualizacion).filter(Boolean);
    if (!fechas.length) return undefined;
    return fechas.sort((a, b) => toKey(b).localeCompare(toKey(a)))[0];
  }, [stockDelProducto]);

  const showInStock = producto?.showInStock ?? true;

  const handleToggleShowInStock = useCallback(
    async (value: boolean) => {
      if (!producto) return;
      setProducto((prev) => (prev ? { ...prev, showInStock: value } : prev));
      const ok = await updateShowInStock(producto.id, value);
      if (!ok) {
        setProducto((prev) => (prev ? { ...prev, showInStock: !value } : prev));
        error("No se pudo actualizar", "La visibilidad del producto no se guardo.");
      }
    },
    [error, producto, updateShowInStock]
  );

  useEffect(() => {
    if (!producto) {
      setDraft(null);
      setIsEditing(false);
      return;
    }
    setDraft({ ...producto });
    setIsEditing(false);
  }, [producto]);

  const handleDelete = useCallback(async () => {
    if (!producto) return;
    const ok = await confirm({
      title: "Eliminar producto",
      message: `Eliminar "${producto.nombre}"? Se eliminara tambien el stock asociado en todos los talleres.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    await removeProducto(producto.id);
    success("Producto eliminado", `${producto.codigo} se elimino correctamente.`);
    router.push("/productos");
  }, [confirm, producto, removeProducto, router, success]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setIsSaving(true);
    const updated = await updateProducto(draft.id, {
      nombre: draft.nombre,
      codigo: draft.codigo,
      proveedor: draft.proveedor,
      ubicacion: draft.ubicacion,
      costoUnitario: draft.costoUnitario,
      precioUnitario: draft.precioUnitario,
      categorias: draft.categorias,
    });

    success("Producto actualizado", `${draft.codigo} se actualizo correctamente.`);
    setProducto(updated ?? { ...draft });
    if (updated?.stocks) setStockDelProducto(updated.stocks);
    setIsEditing(false);
    setIsSaving(false);
  }, [draft, success, updateProducto]);

  const handleSaveStock = useCallback(
    async (input: SaveProductoStockInput): Promise<SaveProductoStockResult> => {
      const result = await saveProductoStock(input);
      if (!result.error) {
        success("Stock actualizado", "La configuracion del taller se guardo correctamente.");
        await loadProducto();
      }
      return result;
    },
    [loadProducto, saveProductoStock, success]
  );

  const handleDeleteStock = useCallback(
    async (stockId: string, tallerNombre: string) => {
      const ok = await confirm({
        title: "Eliminar stock",
        message: `Eliminar la configuracion de stock para ${tallerNombre}?`,
        acceptLabel: "Eliminar",
        cancelLabel: "Cancelar",
      });
      if (!ok) return false;
      const removed = await removeProductoStock(stockId);
      if (!removed) {
        error("No se pudo eliminar el stock", "Intenta nuevamente.");
        return false;
      }
      success("Stock eliminado", "La configuracion del taller se elimino correctamente.");
      await loadProducto();
      return true;
    },
    [confirm, error, loadProducto, removeProductoStock, success]
  );

  if (isLoading && !producto) {
    return (
      <div>
        <ScreenHeader title="Productos" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (!producto || !draft) {
    return (
      <div>
        <Header />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div>
        <Header />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Guardando...</div>
      </div>
    );
  }

  return (
    <div>
      <div css={styles.headerRow}>
        <Header />
        <div style={styles.actions}>
          {isEditing ? (
            <>
              <IconButton
                icon={<X />}
                onClick={() => {
                  setDraft({ ...producto });
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
              <IconButton icon={<Pencil />} onClick={() => setIsEditing(true)} title="Editar" ariaLabel="Editar" />
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
          <h2 style={styles.title}>{producto.nombre}</h2>
        )}
        <div style={styles.code}>{producto.codigo}</div>
      </div>

      <div style={styles.toggleRow}>
        <Toggle checked={showInStock} onChange={handleToggleShowInStock} label="Mostrar en inventario" />
        <span style={styles.toggleLabel}>Mostrar en inventario</span>
      </div>

      <div css={styles.grid}>
        <div style={styles.leftCol}>
          <div>
            <h3 style={styles.sectionTitle}>Stock por taller</h3>
            <ProductoStockMatrix
              productoId={producto.id}
              talleres={talleres}
              stocks={stockDelProducto}
              selectedTallerId={selectedTallerId}
              onSave={handleSaveStock}
              onDelete={handleDeleteStock}
            />
          </div>
        </div>

        <div style={styles.rightCol}>
          <ProductoInfoCard
            codigo={producto.codigo}
            proveedor={producto.proveedor}
            ubicacion={producto.ubicacion}
            categorias={producto.categorias}
            categoriasDisponibles={categoriasDisponibles}
            ultimaActualizacion={ultimaActualizacion}
            isEditing={isEditing}
            draft={{
              codigo: draft.codigo,
              proveedor: draft.proveedor,
              ubicacion: draft.ubicacion,
              categorias: draft.categorias,
            }}
            onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
          />

          <div style={{ marginTop: 12 }}>
            <ProductoPricesCard
              costoUnitario={producto.costoUnitario}
              precioUnitario={producto.precioUnitario}
              stockTotal={stockTotal}
              isEditing={isEditing}
              draft={{
                costoUnitario: draft.costoUnitario,
                precioUnitario: draft.precioUnitario,
              }}
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
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
  },
  titleInput: {
    width: "100%",
    fontSize: 22,
    fontWeight: 600,
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
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
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
  sectionTitle: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
} as const;
