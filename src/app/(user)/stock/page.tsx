"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useStock } from "@/app/providers/StockProvider";
import { useStockFilters, useStockStats } from "@/app/hooks/stock/useStockFilters";
import StockToolbar from "@/app/components/stock/StockToolbar";
import StockFiltersModal from "@/app/components/stock/StockFiltersModal";
import StockCreateModal from "@/app/components/stock/StockCreateModal";
import StockStats from "@/app/components/stock/StockStats";
import StockResults from "@/app/components/stock/StockResults";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";

export default function StockPage() {
  return <StockPageContent />;
}

function StockPageContent() {
  const router = useRouter();
  const { items, loading, categoriasDisponibles } = useStock();
  const state = useStockFilters(items);
  const stats = useStockStats(items);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div>
      <ScreenHeader title="Stock" />

      <div style={{ marginTop: 12 }}>
        <StockStats
          stats={stats}
          selectedEstado={state.filters.estado}
          onSelectEstado={(estado) => state.applyFilters({ ...state.filters, estado })}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <StockToolbar
          search={state.search}
          onSearchChange={state.setSearch}
          onOpenFilters={() => setIsFiltersOpen(true)}
          onOpenCreate={() => setIsCreateOpen(true)}
          chips={state.chips}
          onChipClick={state.removeFilter}
          onClearFilters={state.clearFilters}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.resultsHeader}>
          <div style={styles.resultsTitle}>Inventario</div>
          <div style={styles.resultsCount}>
            {state.itemsFiltrados.length} de {items.length} items
          </div>
        </div>

        {(!loading && state.itemsFiltrados.length === 0) ? (
          <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
            <div style={styles.empty}>
              <div style={styles.emptyTitle}>No se encontraron items</div>
              <div style={styles.emptySub}>Probá ajustando búsqueda o filtros.</div>
            </div>
          </Card>
        ) : (
          <StockResults
            loading={loading}
            items={state.itemsFiltrados}
            onSelect={(i) => router.push(`/stock/${i.id}`)}
          />
        )}
      </div>

      <StockFiltersModal
        open={isFiltersOpen}
        categoriasDisponibles={categoriasDisponibles}
        initial={state.filters}
        onClose={() => setIsFiltersOpen(false)}
        onApply={state.applyFilters}
      />

      <StockCreateModal
        open={isCreateOpen}
        categoriasDisponibles={categoriasDisponibles}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(id) => router.push(`/stock/${id}`)}
      />
    </div>
  );
}

const styles = {
  resultsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: { fontSize: 18, fontWeight: 700 },
  resultsCount: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
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

