"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTenant } from "@/app/providers/TenantProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import IconButton from "@/app/components/ui/IconButton";
import { Pencil, Save, Trash, X } from "lucide-react";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import ProductoTallerStockCard from "@/app/components/productos/ProductoTallerStockCard";
import MovementsCard, { type InventarioMovementRow } from "@/app/components/inventario/MovementsCard";
import ProductoInfoCard from "@/app/components/productos/ProductoInfoCard";
import ProductoPricesCard from "@/app/components/productos/ProductoPricesCard";
import { Producto, StockRegistro, useProductos } from "@/app/providers/ProductosProvider";
import { logger } from "@/lib/logger";

export default function ProductoDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { talleres } = useTenant();
  const { getProductoById, updateProducto, removeProducto, categoriasDisponibles, isLoading } = useProductos();
  const { confirm } = useModalMessage();
  const { success } = useToast();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [stockDelProducto, setStockDelProducto] = useState<StockRegistro[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getProductoById(params.id);
      if (cancelled) return;
      setProducto(res?.producto ?? null);
      setStockDelProducto(res?.stocks ?? []);
      logger.debug("Loaded producto details: ", res);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [getProductoById, params.id]);

  const movimientos = useMemo<InventarioMovementRow[]>(() => {
    const nombrePorTaller = new Map(talleres.map((t) => [t.id, t.nombre] as const));
    const rows: InventarioMovementRow[] = [];
    for (const reg of stockDelProducto) {
      for (const mov of reg.historialMovimientos ?? []) {
        rows.push({
          fecha: mov.fecha,
          tipo: mov.tipo,
          cantidad: mov.cantidad,
          motivo: mov.motivo,
          tallerNombre: nombrePorTaller.get(reg.tallerId) ?? reg.tallerId,
        });
      }
    }
    const toKey = (f: string) => {
      const [dd, mm, yyyy] = String(f ?? "").split("/");
      return `${yyyy ?? ""}${mm ?? ""}${dd ?? ""}`;
    };
    rows.sort((a, b) => toKey(b.fecha).localeCompare(toKey(a.fecha)));
    return rows;
  }, [stockDelProducto, talleres]);

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

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Producto | null>(null);

  useEffect(() => {
    if (!producto) {
      setDraft(null);
      setIsEditing(false);
      return;
    }
    setDraft({ ...producto });  
    setIsEditing(false);
    logger.debug("Producto details loaded, set draft: ", talleres);
    logger.debug(stockDelProducto)
  }, [producto]);

  const handleDelete = useCallback(async () => {
    if (!producto) return;
    const ok = await confirm({
      title: "Eliminar producto",
      message: `¿Eliminar "${producto.nombre}"? Se eliminará también el stock asociado en todos los talleres.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    await removeProducto(producto.id);
    success("Producto eliminado satisfactoriamente");
    router.push("/productos");
  }, [confirm, producto, removeProducto, router, success]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    await updateProducto(draft.id, {
      nombre: draft.nombre,
      codigo: draft.codigo,
      proveedor: draft.proveedor,
      ubicacion: draft.ubicacion,
      costoUnitario: draft.costoUnitario,
      precioUnitario: draft.precioUnitario,
      categorias: draft.categorias,
    });

    success("Producto actualizado satisfactoriamente");
    setIsEditing(false);
  }, [draft, success, updateProducto]);

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
        <ScreenHeader title="Productos" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16 }}>Producto no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div css={styles.headerRow}>
        <ScreenHeader title="Productos" breadcrumbs={["Detalle"]} hasBackButton style={{ width: "100%" }} />
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
            onChange={(e) => setDraft((p: Producto | null) => (p ? { ...p, nombre: e.target.value } : p))}
          />
        ) : (
          <h2 style={styles.title}>{producto.nombre}</h2>
        )}
        <div style={styles.code}>{producto.codigo}</div>
      </div>

      <div css={styles.grid}>
        <div style={styles.leftCol}>
          <div>
            <h3 style={styles.sectionTitle}>Stock por taller</h3>
            <div css={styles.talleresGrid}>
              {talleres.map((t) => {
                const s = stockDelProducto.find((x) => x.tallerId === t.id);
                return (
                  <ProductoTallerStockCard
                    key={t.id}
                    tallerNombre={t.nombre}
                    stockActual={s?.stockActual ?? 0}
                    stockMinimo={s?.stockMinimo ?? 0}
                    stockMaximo={s?.stockMaximo ?? 0}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <MovementsCard movimientos={movimientos} />
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
            draft={{ codigo: draft.codigo, proveedor: draft.proveedor, ubicacion: draft.ubicacion, categorias: draft.categorias }}
            onChange={(patch) => setDraft((p: Producto | null) => (p ? { ...p, ...patch } : p))}
          />

          <div style={{ marginTop: 12 }}>
            <ProductoPricesCard
              costoUnitario={producto.costoUnitario}
              precioUnitario={producto.precioUnitario}
              stockTotal={stockTotal}
              isEditing={isEditing}
              draft={{ costoUnitario: draft.costoUnitario, precioUnitario: draft.precioUnitario }}
              onChange={(patch) => setDraft((p: Producto | null) => (p ? { ...p, ...patch } : p))}
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
  talleresGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
} as const;

