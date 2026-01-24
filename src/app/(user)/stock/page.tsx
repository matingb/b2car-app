"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useTenant } from "@/app/providers/TenantProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useStockFilters, useStockStats } from "@/app/hooks/stock/useStockFilters";
import StockToolbar from "@/app/components/stock/StockToolbar";
import StockFiltersModal from "@/app/components/stock/StockFiltersModal";
import StockCreateModal from "@/app/components/stock/StockCreateModal";
import StockStats from "@/app/components/stock/StockStats";
import Card from "@/app/components/ui/Card";
import Dropdown from "@/app/components/ui/Dropdown";
import { COLOR } from "@/theme/theme";
import StockItemCard from "@/app/components/stock/StockItemCard";
import { LoaderCircle, PlusIcon } from "lucide-react";
import Button from "@/app/components/ui/Button";
import TallerCreateModal from "@/app/components/inventario/TallerCreateModal";

export default function StockPage() {
  return <StockPageContent />;
}

function StockPageContent() {
  const router = useRouter();
  const { talleres, tallerSeleccionadoId, setTallerSeleccionadoId } = useTenant();
  const { getStockItemsForTaller, loading, categoriasDisponibles } = useInventario();
  const items = getStockItemsForTaller(tallerSeleccionadoId);
  const state = useStockFilters(items);
  const stats = useStockStats(items);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTallerCreateOpen, setIsTallerCreateOpen] = useState(false);

  return (
    <div>
      <ScreenHeader title="Stock" />

      <div style={{ marginTop: 12 }}>
        <div style={styles.topRow}>
          <div style={styles.tallerLabel}>Taller</div>
          <div style={{ width: 280, height: 40 }}>
            <Dropdown
              value={tallerSeleccionadoId}
              options={talleres.map((t) => ({ value: t.id, label: t.nombre }))}
              onChange={setTallerSeleccionadoId}
              style={{height: 40, padding: '0 12px'}}
            />
          </div>
            <Button
              icon={<PlusIcon size={20} />}
              text="Nuevo taller"
              onClick={() => setIsTallerCreateOpen(true)}
              style={{ height: 40 }}
            />
        </div>
      </div>

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
          <div style={styles.resultsTitle}><h2>Inventario</h2></div>
          <div style={styles.resultsCount}>
            {state.itemsFiltrados.length} de {items.length} items
          </div>
        </div>

        {!loading && state.itemsFiltrados.length === 0 ? (
          <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
            <div style={styles.empty}>
              <div style={styles.emptyTitle}>No se encontraron items</div>
              <div style={styles.emptySub}>Probá ajustando búsqueda o filtros.</div>
            </div>
          </Card>
        ) : (
          <>
            {loading ? (
              <div style={styles.loading} data-testid="stock-loading">
                <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
              </div>
            ) : (
              <div style={styles.list} data-testid="stock-results">
                {state.itemsFiltrados.map((item) => (
                  <StockItemCard
                    key={item.id}
                    item={item}
                    onClick={(i) => router.push(`/stock/${i.id}`)}
                  />
                ))}
              </div>
            )}
          </>
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
        tallerId={tallerSeleccionadoId}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(id) => router.push(`/stock/${id}`)}
      />

      <TallerCreateModal
        open={isTallerCreateOpen}
        onClose={() => setIsTallerCreateOpen(false)}
      />
    </div>
  );
}

const styles = {
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  tallerLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
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
  loading: {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
  },
} as const;

