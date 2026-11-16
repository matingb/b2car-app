"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import ScrollPage from "@/app/components/ui/ScrollPage";
import ListSpinner from "@/app/components/ui/ListSpinner";
import Button from "@/app/components/ui/Button";
import VehiculoCard from "@/app/components/vehiculos/VehiculoCard";
import CreateVehiculoModal from "@/app/components/vehiculos/CreateVehiculoModal";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { type Vehiculo } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { PlusIcon } from "lucide-react";

const LIMIT_STEP = 50;

export default function VehiculosPage() {
  const router = useRouter();
  const { vehiculos, loading, hasMore = false, fetchAll } = useVehiculos();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(LIMIT_STEP);
  const [searching, setSearching] = useState(false);

  const searchTrimmed = search.trim();

  const appliedQueryRef = useRef<string | null>(null);
  const latestQueryRef = useRef<string>(searchTrimmed);

  useEffect(() => {
    setLimit(LIMIT_STEP);
  }, [searchTrimmed]);

  useEffect(() => {
    const isNewQuery = appliedQueryRef.current !== searchTrimmed;
    latestQueryRef.current = searchTrimmed;

    const timeoutId = window.setTimeout(() => {
      if (typeof fetchAll !== "function") return;
      if (isNewQuery) setSearching(true);

      void Promise.resolve(
        fetchAll({
          limit,
          search: searchTrimmed || undefined,
        })
      ).finally(() => {
        if (latestQueryRef.current !== searchTrimmed) return;
        appliedQueryRef.current = searchTrimmed;
        setSearching(false);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [fetchAll, limit, searchTrimmed]);

  const handleClearFilters = () => {
    setSearch("");
  };

  return (
    <div>
      <ScreenHeader title="Vehículos" />
      <div style={styles.searchBarContainer}>
        <div css={styles.searchRow}>
          <div style={styles.searchField}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar vehículos (patente, marca, modelo, cliente)..."
              inputTestId="vehiculos-search"
              style={styles.searchBar}
            />
          </div>
          <Button
            icon={<PlusIcon size={20} />}
            text="Crear vehículo"
            onClick={() => setIsModalOpen(true)}
            style={styles.newButton}
            dataTestId="vehiculos-open-create"
          />
        </div>
      </div>

      {searching || (loading && vehiculos.length === 0) ? (
        <ListSpinner dataTestId="vehiculos-loading" />
      ) : vehiculos.length === 0 ? (
        <div style={styles.emptyContainer} data-testid="vehiculos-empty-state">
          <p style={styles.emptyText}>
            {searchTrimmed
              ? "No se encontraron vehículos para la búsqueda."
              : "No hay vehículos registrados."}
          </p>
          {searchTrimmed && (
            <Button
              text="Limpiar búsqueda"
              onClick={handleClearFilters}
              outline
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      ) : (
        <ScrollPage
          loadingMore={loading && vehiculos.length > 0}
          hasMore={hasMore}
          onLoadMore={() => setLimit((current) => current + LIMIT_STEP)}
          loadingMoreLabel="Cargando más vehículos..."
        >
          <div style={styles.vehiclesList}>
            {vehiculos.map((vehiculo: Vehiculo) => (
              <VehiculoCard
                key={vehiculo.id}
                vehiculo={vehiculo}
                onClick={() => router.push(`/vehiculos/${vehiculo.id}`)}
              />
            ))}
          </div>
        </ScrollPage>
      )}

      <CreateVehiculoModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  searchRow: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  searchField: {
    flex: 1,
    minWidth: 0,
  },
  searchBar: {
    width: "100%",
  },
  newButton: {
    height: "40px",
    whiteSpace: "nowrap" as const,
  },
  vehiclesList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 16,
  },
  emptyContainer: {
    padding: "48px 16px",
    textAlign: "center" as const,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyText: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    margin: 0,
  },
} as const;
