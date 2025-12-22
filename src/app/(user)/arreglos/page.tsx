"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { Filter, PlusIcon } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import ArregloFiltersModal, { ArregloFilters } from "@/app/components/arreglos/ArregloFiltersModal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

export default function ArreglosPage() {
  return <ArreglosPageContent />;
}

function ArreglosPageContent() {
  const router = useRouter();
  const { arreglos, loading } = useArreglos();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ArregloFilters>({
    fechaDesde: "",
    fechaHasta: "",
    patente: "",
    tipo: "",
  });

  const emptyFilters: ArregloFilters = {
    fechaDesde: "",
    fechaHasta: "",
    patente: "",
    tipo: "",
  };
  const arreglosFiltrados = useMemo(() => {
    if (!arreglos) return [];
    const q = search.trim().toLowerCase();
    let result = arreglos;
    if (q) {
      result = result.filter((a: Arreglo) => {
        // Busca en las propiedades planas y en la patente del vehiculo asociado
        const inFlat = Object.values(a ?? {}).some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        );
        const patente = String(a?.vehiculo?.patente ?? "").toLowerCase();
        const inPatente = patente.includes(q);
        return inFlat || inPatente;
      });
    }

    const patenteFilter = filters.patente.trim().toLowerCase();
    if (patenteFilter) {
      result = result.filter((a: Arreglo) =>
        String(a?.vehiculo?.patente ?? "").toLowerCase().includes(patenteFilter)
      );
    }

    const tipoFilter = filters.tipo.trim().toLowerCase();
    if (tipoFilter) {
      result = result.filter((a: Arreglo) =>
        String(a?.tipo ?? "").toLowerCase().includes(tipoFilter)
      );
    }

    const hasDateFilter = filters.fechaDesde || filters.fechaHasta;
    if (hasDateFilter) {
      const from = filters.fechaDesde ? new Date(filters.fechaDesde) : null;
      const to = filters.fechaHasta ? new Date(filters.fechaHasta) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);

      result = result.filter((a: Arreglo) => {
        const fecha = new Date(a.fecha);
        if (Number.isNaN(fecha.getTime())) return false;
        if (from && fecha < from) return false;
        if (to && fecha > to) return false;
        return true;
      });
    }

    return result;
  }, [arreglos, search, filters]);

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return "";
    const normalized = dateString.replace(" ", "T");
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) {
      const base = dateString.slice(0, 10);
      const [y, m, da] = base.split("-");
      if (y && m && da) return `${da}/${m}/${y}`;
      return base;
    }
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(d);
  };

  type ChipKind = "fechaRange" | "fechaDesde" | "fechaHasta" | "patente" | "tipo";
  type Chip = { key: string; label: string; kind: ChipKind };

  const chips = useMemo<Chip[]>(() => {
    const items: Chip[] = [];

    if (filters.fechaDesde || filters.fechaHasta) {
      const desde = formatDateLabel(filters.fechaDesde);
      const hasta = formatDateLabel(filters.fechaHasta);
      if (filters.fechaDesde && filters.fechaHasta) {
        items.push({ key: "fechaRange", label: `${desde} - ${hasta}`, kind: "fechaRange" });
      } else if (filters.fechaDesde) {
        items.push({ key: "fechaDesde", label: `Desde: ${desde}`, kind: "fechaDesde" });
      } else if (filters.fechaHasta) {
        items.push({ key: "fechaHasta", label: `Hasta: ${hasta}`, kind: "fechaHasta" });
      }
    }

    if (filters.patente.trim()) {
      items.push({ key: "patente", label: filters.patente.trim(), kind: "patente" });
    }

    if (filters.tipo.trim()) {
      items.push({ key: "tipo", label: filters.tipo.trim(), kind: "tipo" });
    }

    return items;
  }, [filters]);

  const removeChip = (kind: ChipKind) => {
    setFilters((prev) => {
      switch (kind) {
        case "fechaRange":
          return { ...prev, fechaDesde: "", fechaHasta: "" };
        case "fechaDesde":
          return { ...prev, fechaDesde: "" };
        case "fechaHasta":
          return { ...prev, fechaHasta: "" };
        case "patente":
          return { ...prev, patente: "" };
        case "tipo":
          return { ...prev, tipo: "" };
        default:
          return prev;
      }
    });
  };

  return (
    <div>
      <ScreenHeader title="Arreglos" />
      <div style={styles.searchBarContainer}>
        <div style={styles.searchRow}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar arreglos..."
            style={styles.searchBar}
          />
          <Button icon={<Filter size={20} />} text="Filtrar" onClick={() => setIsFilterModalOpen(true)} style={styles.filterButton} outline />
          <Button
            style={styles.newButton}
            icon={<PlusIcon size={20} />}
            text="Crear arreglo"
            onClick={() => setIsCreateModalOpen(true)}
          />
        </div>
        {chips.length > 0 && (
          <div className="chips-container chips-container--with-clear" aria-label="Filtros aplicados">
            <div className="chips-container__items">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="chip-filter chip-filter--selected"
                  css={styles.chip}
                  onClick={() => removeChip(chip.kind)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="chips-container__clear"
              style={styles.clearButton}
              onClick={() => setFilters(emptyFilters)}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {arreglosFiltrados.map((arreglo) => (
            <ArregloItem
              key={arreglo.id}
              arreglo={arreglo}
              onClick={(a: Arreglo) => router.push(`/arreglos/${a.id}`)}
            />
          ))}
        </div>
      )}

      <ArregloModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      <ArregloFiltersModal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setFilters}
        initial={filters}
      />
    </div>
  );
}

const styles = {
  searchBarContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  searchBar: {
    width: "100%",
    flex: 1,
  },
  newButton: {
    height: '40px',
    width: '44px',
  },
  filterButton: {
    height: '40px',
    width: '48px',
    minWidth: '100px',
  },
  chip: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: '14px',
      padding: '6px 12px',
    },
  }),
  clearButton: {
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
} as const;
