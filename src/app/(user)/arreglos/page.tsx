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

export default function ArreglosPage() {
  return <ArreglosPageContent />;
}

function ArreglosPageContent() {
  const router = useRouter();
  const { arreglos, loading } = useArreglos();
  const state = useArreglosFilters(arreglos);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  return (
    <div>
      <ScreenHeader title="Arreglos" />
      <ArreglosToolbar
        search={state.search}
        onSearchChange={state.setSearch}
        onOpenFilters={() => setIsFilterModalOpen(true)}
        onOpenCreate={() => setIsCreateModalOpen(true)}
        chips={state.chips}
        onChipClick={state.removeFilter}
        onClearFilters={state.clearFilters}
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
