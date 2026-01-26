"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useProductosFilters } from "@/app/hooks/productos/useProductosFilters";
import ProductosToolbar from "@/app/components/productos/ProductosToolbar";
import ProductosFiltersModal from "@/app/components/productos/ProductosFiltersModal";
import ProductoCreateModal from "@/app/components/productos/ProductoCreateModal";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import ProductoItemCard from "@/app/components/productos/ProductoItemCard";
import { LoaderCircle } from "lucide-react";
import { useProductos } from "@/app/providers/ProductosProvider";
import { css } from "@emotion/react";

export default function ProductosPage() {
  return <ProductosPageContent />;
}

function ProductosPageContent() {
  const router = useRouter();
  const { productos, categoriasDisponibles, isLoading } = useProductos();
  const state = useProductosFilters(productos);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div>
      <div style={styles.headerTop}>
        <ScreenHeader title="Productos" />
      </div>

      <div style={{ marginTop: 12 }}>
        <ProductosToolbar
          search={state.search}
          onSearchChange={state.setSearch}
          onOpenFilters={() => setIsFiltersOpen(true)}
          chips={state.chips}
          onChipClick={state.removeFilter}
          onClearFilters={state.clearFilters}
          onNewProductClick={() => setIsCreateOpen(true)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.resultsHeader}>
          <div style={styles.resultsTitle}><h2>Listado</h2></div>
          <div style={styles.resultsCount}>
            {state.productosFiltrados.length} de {productos.length} productos
          </div>
        </div>

        {!isLoading && state.productosFiltrados.length === 0 ? (
          <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
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
          <div css={styles.list}>
            {state.productosFiltrados.map((p) => (
              <ProductoItemCard
                key={p.id}
                producto={p}
                onClick={() => router.push(`/productos/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <ProductosFiltersModal
        open={isFiltersOpen}
        categoriasDisponibles={categoriasDisponibles}
        initial={state.filters}
        onClose={() => setIsFiltersOpen(false)}
        onApply={state.applyFilters}
      />

      <ProductoCreateModal
        open={isCreateOpen}
        categoriasDisponibles={categoriasDisponibles}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}

const styles = {
  headerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: { fontSize: 18, fontWeight: 700 },
  resultsCount: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  list: css({
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))", 
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

