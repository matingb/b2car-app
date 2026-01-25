"use client";

import React, { useMemo, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useProductosFilters } from "@/app/hooks/productos/useProductosFilters";
import ProductosToolbar from "@/app/components/productos/ProductosToolbar";
import ProductosFiltersModal from "@/app/components/productos/ProductosFiltersModal";
import ProductoCreateModal from "@/app/components/productos/ProductoCreateModal";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import ProductoItemCard from "@/app/components/productos/ProductoItemCard";
import Button from "@/app/components/ui/Button";
import { PlusIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";

export default function ProductosPage() {
  return <ProductosPageContent />;
}

function ProductosPageContent() {
  const router = useRouter();
  const { productos, stockRegistros, categoriasDisponibles, loading } = useInventario();
  const state = useProductosFilters(productos);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const stockPorProducto = useMemo(() => {
    const map = new Map<string, typeof stockRegistros>();
    for (const s of stockRegistros) {
      const prev = map.get(s.productoId) ?? [];
      map.set(s.productoId, [...prev, s]);
    }
    return map;
  }, [stockRegistros]);

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

        {!loading && state.productosFiltrados.length === 0 ? (
          <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
            <div style={styles.empty}>
              <div style={styles.emptyTitle}>No se encontraron productos</div>
              <div style={styles.emptySub}>Probá ajustando búsqueda o filtros.</div>
            </div>
          </Card>
        ) : loading ? (
          <div style={styles.loading} data-testid="productos-loading">
            <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
          </div>
        ) : (
          <div style={styles.list}>
            {state.productosFiltrados.map((p) => (
              <ProductoItemCard
                key={p.productoId}
                producto={p}
                stock={stockPorProducto.get(p.productoId) ?? []}
                onClick={() => router.push(`/productos/${p.productoId}`)}
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
        onCreated={(id) => router.push(`/productos/${id}`)}
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
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
  },
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

