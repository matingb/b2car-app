"use client";

import React, { useEffect, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter, useSearchParams } from "next/navigation";
import { useProductosFilters } from "@/app/hooks/productos/useProductosFilters";
import ProductosToolbar from "@/app/components/productos/ProductosToolbar";
import ProductoCreateModal from "@/app/components/productos/ProductoCreateModal";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import ProductoItemCard from "@/app/components/productos/ProductoItemCard";
import ProductosTable from "@/app/components/productos/ProductosTable";
import { LayoutList, LoaderCircle, Table } from "lucide-react";
import { useProductos } from "@/app/providers/ProductosProvider";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { css } from "@emotion/react";
import StockStats from "@/app/components/stock/StockStats";
import TallerSelector from "@/app/components/ui/TallerSelector";
import ProductosTabsNav, { type ProductosTabKey } from "@/app/components/productos/ProductosTabsNav";
import ProveedoresTabContent from "@/app/components/proveedores/ProveedoresTabContent";

export default function ProductosPage() {
  return <ProductosPageContent />;
}

function ProductosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { productos, categoriasDisponibles, isLoading } = useProductos();
  const { proveedores } = useProveedores();

  const tabParam = searchParams.get("tab") === "proveedores" ? "proveedores" : "productos";
  const [activeTab, setActiveTab] = useState<ProductosTabKey>(tabParam);

  useEffect(() => {
    const currentParam = searchParams.get("tab") === "proveedores" ? "proveedores" : "productos";
    setActiveTab(currentParam);
  }, [searchParams]);

  const handleTabChange = (newTab: ProductosTabKey) => {
    setActiveTab(newTab);
    const url = newTab === "proveedores" ? "/productos?tab=proveedores" : "/productos";
    router.push(url);
  };

  const [selectedTallerId, setSelectedTallerId] = useState("");
  const state = useProductosFilters(productos, selectedTallerId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [desktopView, setDesktopView] = useState<"table" | "cards">("table");

  return (
    <div>
      <ScreenHeader
        title={activeTab === "proveedores" ? "Proveedores" : "Productos"}
        subtitle={
          activeTab === "proveedores"
            ? "Gestioná los datos fiscales y de contacto de tus proveedores"
            : "Definí qué productos existen en el sistema y sus características"
        }
      />

      <ProductosTabsNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
      />

      {activeTab === "proveedores" ? (
        <ProveedoresTabContent />
      ) : (
        <>
          <TallerSelector
            allOption="Vista general"
            value={selectedTallerId}
            onChange={setSelectedTallerId}
          />
          <div style={{ marginTop: 12 }}>
            <StockStats
              stats={state.stats}
              selectedEstado={state.filters.estado}
              onSelectEstado={(estado) =>
                state.applyFilters({ ...state.filters, estado })
              }
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <ProductosToolbar
              search={state.search}
              onSearchChange={state.setSearch}
              categoriasDisponibles={categoriasDisponibles}
              categorias={state.filters.categorias}
              onCategoriasChange={(categorias) =>
                state.applyFilters({ ...state.filters, categorias })
              }
              showEsporadicos={state.filters.visibilidad === "todos"}
              onShowEsporadicosChange={(checked) =>
                state.applyFilters({
                  ...state.filters,
                  visibilidad: checked ? "todos" : "inventario",
                })
              }
              onNewProductClick={() => setIsCreateOpen(true)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.resultsHeader}>
              <div style={styles.resultsTitleGroup}>
                <div style={styles.resultsTitle}><h2>Listado</h2></div>
                <div style={styles.resultsCount}>
                  {state.productosFiltrados.length} de {productos.length} productos
                </div>
              </div>

              {/* Selector de vista (solo visible en pantallas desktop > lg) */}
              <div css={styles.toggleContainer}>
                <div css={styles.toggleGroup} role="group" aria-label="Modo de visualización">
                  <button
                    type="button"
                    onClick={() => setDesktopView("table")}
                    css={[
                      styles.toggleButton,
                      desktopView === "table" && styles.toggleButtonActive,
                    ]}
                    aria-pressed={desktopView === "table"}
                    data-testid="view-toggle-table"
                  >
                    <Table size={15} />
                    <span>Tabla</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopView("cards")}
                    css={[
                      styles.toggleButton,
                      desktopView === "cards" && styles.toggleButtonActive,
                    ]}
                    aria-pressed={desktopView === "cards"}
                    data-testid="view-toggle-cards"
                  >
                    <LayoutList size={15} />
                    <span>Tarjetas</span>
                  </button>
                </div>
              </div>
            </div>

            {!isLoading && state.productosFiltrados.length === 0 ? (
              <Card style={{ backgroundColor: COLOR.BACKGROUND.SECONDARY }}>
                <div style={styles.empty}>
                  <div style={styles.emptyTitle}>No se encontraron productos</div>
                  <div style={styles.emptySub}>Probá ajustando búsqueda o filtros.</div>
                </div>
              </Card>
            ) : isLoading ? (
              <div style={styles.loading} data-testid="productos-loading">
                <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
              </div>
            ) : (
              <>
                {desktopView === "table" && (
                  <div css={styles.desktopContainer}>
                    <ProductosTable
                      productos={state.productosFiltrados}
                      tallerId={selectedTallerId}
                      onProductoClick={(p) => router.push(`/productos/${p.id}`)}
                    />
                  </div>
                )}

                <div
                  css={
                    desktopView === "table"
                      ? styles.cardsListResponsive
                      : styles.cardsList
                  }
                >
                  {state.productosFiltrados.map((p) => (
                    <ProductoItemCard
                      key={p.id}
                      producto={p}
                      tallerId={selectedTallerId}
                      onClick={() => router.push(`/productos/${p.id}`)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <ProductoCreateModal
            open={isCreateOpen}
            categoriasDisponibles={categoriasDisponibles}
            onClose={() => setIsCreateOpen(false)}
          />
        </>
      )}
    </div>
  );
}

const styles = {
  resultsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitleGroup: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
  },
  resultsTitle: { fontSize: 18, fontWeight: 700 },
  resultsCount: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  toggleContainer: css({
    display: "flex",
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  toggleGroup: css({
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    padding: 3,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    gap: 2,
  }),
  toggleButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  toggleButtonActive: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  }),
  desktopContainer: css({
    marginTop: 12,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  cardsList: css({
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))", 
    },
  }),
  cardsListResponsive: css({
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
    [`@media (min-width: ${BREAKPOINTS.lg + 1}px)`]: {
      display: "none",
    },
  }),
  loading: {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
  },
  empty: {
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: 700 },
  emptySub: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
} as const;
