"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import ArregloFiltersModal from "@/app/components/arreglos/ArregloFiltersModal";
import ArreglosToolbar from "@/app/components/arreglos/ArreglosToolbar";
import ArreglosResults from "@/app/components/arreglos/ArreglosResults";
import { useArreglosFilters } from "@/app/hooks/arreglos/useArreglosFilters";
import { useState } from "react";
import { useTenant } from "@/app/providers/TenantProvider";
import Dropdown from "@/app/components/ui/Dropdown";
import { COLOR } from "@/theme/theme";

export default function ArreglosPage() {
  return <ArreglosPageContent />;
}

function ArreglosPageContent() {
  const router = useRouter();
  const { arreglos, loading } = useArreglos();
  const { talleres, tallerSeleccionadoId, setTallerSeleccionadoId } = useTenant();
  const state = useArreglosFilters(arreglos);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);;

  return (
    <div>
      <ScreenHeader title="Arreglos" />

      {talleres.length > 1 ? (
        <div style={{ marginTop: 12 }}>
          <div style={styles.topRow}>
            <div style={styles.leftTopRow}>
              <div style={styles.tallerLabel}>Taller</div>
              <div style={{ width: 280, height: 40 }}>
                <Dropdown
                  value={tallerSeleccionadoId}
                  options={talleres.map((t) => ({ value: t.id, label: t.nombre }))}
                  onChange={setTallerSeleccionadoId}
                  style={{ height: 40, padding: "0 12px" }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
      <ArreglosResults
        loading={loading}
        items={state.arreglosFiltrados}
        onSelect={(a) => router.push(`/arreglos/${a.id}`)}
            />

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
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leftTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  tallerLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  searchBarContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
} as const;