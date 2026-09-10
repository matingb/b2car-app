"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import ArregloFiltersModal from "@/app/components/arreglos/ArregloFiltersModal";
import ArreglosToolbar from "@/app/components/arreglos/ArreglosToolbar";
import ArreglosResults from "@/app/components/arreglos/ArreglosResults";
import ScrollPage from "@/app/components/ui/ScrollPage";
import { useArreglosFilters } from "@/app/hooks/arreglos/useArreglosFilters";
import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/app/providers/TenantProvider";
import TallerSelector from "@/app/components/ui/TallerSelector";

const LIMIT_STEP = 50;

export default function ArreglosPage() {
  const router = useRouter();
  const { arreglos, loading, hasMore, fetchAll } = useArreglos();
  const { tallerSeleccionadoId } = useTenant();
  const state = useArreglosFilters(arreglos);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [limit, setLimit] = useState(LIMIT_STEP);

  const debouncedSearch = useMemo(() => state.search.trim(), [state.search]);

  useEffect(() => {
    setLimit(LIMIT_STEP);
  }, [
    tallerSeleccionadoId,
    debouncedSearch,
    state.filters.patente,
    state.filters.estado,
    state.filters.estadoPago,
    state.filters.fechaDesde,
    state.filters.fechaHasta,
  ]);

  const filterStrings = useMemo(
    () => ({
      patente: state.filters.patente || undefined,
      estado: state.filters.estado || undefined,
      estadoPago: state.filters.estadoPago || undefined,
      fechaDesde: state.filters.fechaDesde || undefined,
      fechaHasta: state.filters.fechaHasta || undefined,
    }),
    [
      state.filters.patente,
      state.filters.estado,
      state.filters.estadoPago,
      state.filters.fechaDesde,
      state.filters.fechaHasta,
    ]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (typeof fetchAll !== "function" || !tallerSeleccionadoId || !limit) return;
      void fetchAll({
        tallerId: tallerSeleccionadoId,
        limit,
        search: debouncedSearch || undefined,
        ...filterStrings,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAll, tallerSeleccionadoId, limit, debouncedSearch, filterStrings]);

  const loadingInitial = loading && arreglos.length === 0;
  const loadingMore = loading && arreglos.length > 0;

  const handleLoadMore = () => {
    setLimit((current) => current + LIMIT_STEP);
  };

  return (
    <div>
      <ScreenHeader title="Arreglos" />

      <TallerSelector />

      <ArreglosToolbar
        search={state.search}
        onSearchChange={state.setSearch}
        onOpenFilters={() => setIsFilterModalOpen(true)}
        onOpenCreate={() => setIsCreateModalOpen(true)}
        chips={state.chips}
        onChipClick={state.removeFilter}
        onClearFilters={state.clearFilters}
        style={styles.searchBarContainer}
      />
      <ScrollPage
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        loadingMoreLabel="Cargando más arreglos..."
      >
        <ArreglosResults
          loading={loadingInitial}
          items={state.arreglosFiltrados}
          onSelect={(a) => router.push(`/arreglos/${a.id}`)}
          showObservaciones={false}
        />
      </ScrollPage>

      <ArregloModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      <ArregloFiltersModal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={state.applyFilters}
        initial={state.filters}
      />
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    marginTop: 16,
  },
} as const;
