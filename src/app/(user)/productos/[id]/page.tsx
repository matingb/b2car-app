"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTenant } from "@/app/providers/TenantProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import IconButton from "@/app/components/ui/IconButton";
import Card from "@/app/components/ui/Card";
import NumberInput from "@/app/components/ui/NumberInput";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { Building2, Layers3, Package, Pencil, Save, Trash, TrendingUp, X } from "lucide-react";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
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
import { formatArs } from "@/lib/format";

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
  const [categoriaToAdd, setCategoriaToAdd] = useState("");

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

  const categoriaOptions = useMemo<AutocompleteOption[]>(() => {
    const selected = draft?.categorias ?? [];
    return categoriasDisponibles
      .filter((categoria) => !selected.includes(categoria))
      .map((categoria) => ({ value: categoria, label: categoria }));
  }, [categoriasDisponibles, draft?.categorias]);

  const margen = useMemo(() => {
    const costo = draft?.costoUnitario ?? producto?.costoUnitario ?? 0;
    const precio = draft?.precioUnitario ?? producto?.precioUnitario ?? 0;
    if (!costo) return 0;
    return ((precio - costo) / costo) * 100;
  }, [draft?.costoUnitario, draft?.precioUnitario, producto?.costoUnitario, producto?.precioUnitario]);

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

      <Card style={styles.detailCard}>
        <div css={styles.detailToolbar}>
          <div css={styles.productIdentity}>
            <span style={styles.productIcon}>
              <Package size={19} />
            </span>
            {isEditing ? (
              <input
                aria-label="Nombre del producto"
                style={styles.nameInput}
                value={draft.nombre}
                onChange={(e) => setDraft((current) => (current ? { ...current, nombre: e.target.value } : current))}
              />
            ) : (
              <h2 style={styles.productName}>{producto.nombre}</h2>
            )}
            <span style={styles.identityDivider} />
            {isEditing ? (
              <input
                aria-label="Código del producto"
                style={styles.codeInput}
                value={draft.codigo}
                onChange={(e) => setDraft((current) => (current ? { ...current, codigo: e.target.value } : current))}
              />
            ) : (
              <span style={styles.codeBadge}>{producto.codigo}</span>
            )}
          </div>

          <div style={styles.inventoryToggle}>
            <Toggle checked={showInStock} onChange={handleToggleShowInStock} label="Mostrar en inventario" />
            <span>Mostrar en inventario</span>
          </div>
        </div>

        <div css={styles.detailBody}>
          <section css={styles.primarySummary}>
            <div css={styles.priceSummary}>
              <div>
                <div style={styles.eyebrow}>PRECIO DE VENTA</div>
                <div style={styles.priceRow}>
                  {isEditing ? (
                    <NumberInput
                      aria-label="Precio de venta"
                      minValue={0}
                      value={draft.precioUnitario}
                      onValueChange={(precioUnitario) =>
                        setDraft((current) => (current ? { ...current, precioUnitario } : current))
                      }
                      style={styles.priceInput}
                    />
                  ) : (
                    <div style={styles.priceValue}>{formatArs(producto.precioUnitario, { maxDecimals: 0, minDecimals: 0 })}</div>
                  )}
                  <span style={styles.marginPill}><TrendingUp size={14} /> Margen: {margen.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div css={styles.metricsRow}>
              <Metric label="Precio de compra">
                {isEditing ? (
                  <NumberInput
                    aria-label="Precio de compra"
                    minValue={0}
                    value={draft.costoUnitario}
                    onValueChange={(costoUnitario) =>
                      setDraft((current) => (current ? { ...current, costoUnitario } : current))
                    }
                    style={styles.metricInput}
                  />
                ) : (
                  formatArs(producto.costoUnitario, { maxDecimals: 0, minDecimals: 0 })
                )}
              </Metric>
              <Metric label="Stock disponible">{stockTotal} uds.</Metric>
            </div>
          </section>

          <section css={styles.secondarySummary}>
            <div>
              <div style={styles.eyebrow}><Layers3 size={14} /> CATEGORÍAS</div>
              {isEditing ? (
                <div>
                  <Autocomplete
                    options={categoriaOptions}
                    value={categoriaToAdd}
                    onChange={(categoria) => {
                      if (!categoria || !categoriasDisponibles.includes(categoria)) {
                        setCategoriaToAdd("");
                        return;
                      }
                      setDraft((current) =>
                        current && !current.categorias.includes(categoria)
                          ? { ...current, categorias: [...current.categorias, categoria] }
                          : current
                      );
                      setCategoriaToAdd("");
                    }}
                    placeholder="Agregar categoría..."
                  />
                  <CategoryList
                    categories={draft.categorias}
                    editable
                    onRemove={(categoria) =>
                      setDraft((current) =>
                        current
                          ? { ...current, categorias: current.categorias.filter((item) => item !== categoria) }
                          : current
                      )
                    }
                  />
                </div>
              ) : (
                <CategoryList categories={producto.categorias} />
              )}
            </div>

            <InfoField icon={<Building2 size={16} />} label="Proveedor">
              {isEditing ? (
                <input
                  style={styles.infoInput}
                  value={draft.proveedor}
                  onChange={(e) => setDraft((current) => (current ? { ...current, proveedor: e.target.value } : current))}
                />
              ) : (
                producto.proveedor || "-"
              )}
            </InfoField>
            <div style={styles.updatedAt}><span>Última actualización:</span> <strong>{ultimaActualizacion ?? "Sin movimientos"}</strong></div>
          </section>
        </div>
      </Card>

      <div style={styles.stockSection}>
        <h3 style={styles.sectionTitle}>Stock por taller</h3>
        <p style={styles.sectionDescription}>Configuración y niveles de inventario por cada taller.</p>
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
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{children}</div>
    </div>
  );
}

function CategoryList({
  categories,
  editable = false,
  onRemove,
}: {
  categories: string[];
  editable?: boolean;
  onRemove?: (category: string) => void;
}) {
  if (!categories.length) return <span style={styles.emptyValue}>Sin categorías</span>;

  return (
    <div style={styles.categoryList}>
      {categories.map((category) => (
        <span key={category} style={styles.categoryTag}>
          {category}
          {editable ? (
            <button
              type="button"
              aria-label={`Quitar categoría ${category}`}
              onClick={() => onRemove?.(category)}
              style={styles.removeCategoryButton}
            >
              <X size={13} />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function InfoField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={styles.infoField}>
      <div style={styles.infoLabel}>{icon}{label}</div>
      <div style={styles.infoValue}>{children}</div>
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
  detailCard: {
    marginTop: 16,
    padding: 0,
    overflow: "hidden",
    background: COLOR.BACKGROUND.SECONDARY,
  },
  detailToolbar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 20px",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  }),
  productIdentity: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  }),
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
    flexShrink: 0,
  },
  productName: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  nameInput: {
    minWidth: 0,
    width: "100%",
    maxWidth: 440,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 17,
    fontWeight: 700,
  },
  identityDivider: {
    width: 1,
    height: 22,
    background: COLOR.BORDER.SUBTLE,
    flexShrink: 0,
  },
  codeBadge: {
    padding: "6px 10px",
    borderRadius: 7,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  },
  codeInput: {
    width: 132,
    padding: "6px 10px",
    borderRadius: 7,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 700,
  },
  inventoryToggle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  },
  detailBody: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(280px, 0.95fr)",
    padding: "28px 32px 22px",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
      gap: 24,
      padding: "22px 20px",
    },
  }),
  primarySummary: css({
    paddingRight: 16,
    borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      paddingRight: 0,
      paddingBottom: 24,
      borderRight: "none",
      borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    },
  }),
  priceSummary: css({ display: "block" }),
  priceRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 12,
    marginTop: 8,
  },
  marginPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 9px",
    borderRadius: 7,
    border: "none",
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    color: COLOR.SEMANTIC.SUCCESS,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  },
  metricsRow: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 24,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  secondarySummary: css({
    display: "flex",
    flexDirection: "column",
    gap: 20,
    paddingLeft: 24,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      paddingLeft: 0,
    },
  }),
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },
  priceValue: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: "-0.03em",
  },
  priceInput: {
    width: 190,
    padding: "9px 12px",
    fontSize: 28,
    fontWeight: 700,
  },
  metricCard: {
    minHeight: 72,
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  metricLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 700,
  },
  metricInput: {
    marginTop: 5,
    padding: "6px 8px",
    fontSize: 15,
    fontWeight: 700,
  },
  categoryList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: 10,
  },
  categoryTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 9px",
    borderRadius: 999,
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 12,
    fontWeight: 600,
  },
  removeCategoryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
  },
  emptyValue: {
    display: "block",
    marginTop: 10,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  infoField: {
    minWidth: 0,
  },
  infoLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 600,
  },
  infoValue: {
    marginTop: 7,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    fontWeight: 700,
  },
  infoInput: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
  },
  updatedAt: {
    marginTop: "auto",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  },
  stockSection: {
    marginTop: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
  sectionDescription: { margin: "-3px 0 12px", color: COLOR.TEXT.SECONDARY, fontSize: 14 },
} as const;
