"use client";

import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import { Filter, PlusIcon } from "lucide-react";
import FilterChip from "@/app/components/ui/FilterChip";
import type { ChipKind } from "@/app/hooks/arreglos/useArreglosFilters";
import { COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type Chip = { key: string; text: string; kind: ChipKind };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  onOpenCreate: () => void;
  chips: Chip[];
  onChipClick: (kind: ChipKind) => void;
  onClearFilters: () => void;
  style?: React.CSSProperties;
};

export default function ArreglosToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  onOpenCreate,
  chips,
  onChipClick,
  onClearFilters,
  style,
}: Props) {
  return (
    <div style={{ ...styles.searchBarContainer, ...style }}>
      <div style={styles.searchRow}>
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar arreglos..."
          inputTestId="arreglos-search"
          style={styles.searchBar}
        />
        <Button
          icon={<Filter size={20} />}
          text="Filtrar"
          onClick={onOpenFilters}
          style={styles.filterButton}
          dataTestId="arreglos-open-filters"
          outline
        />
        <Button
          style={styles.newButton}
          icon={<PlusIcon size={20} />}
          text="Crear arreglo"
          onClick={onOpenCreate}
          dataTestId="arreglos-open-create"
        />
      </div>

      {chips.length > 0 && (
        <div css={styles.chipsContainer} aria-label="Filtros aplicados" data-testid="arreglos-active-filters">
          <div css={styles.chipsItems}>
            {chips.map((chip) => (
              <FilterChip
                key={chip.key}
                text={chip.text}
                onClick={() => onChipClick(chip.kind)}
              />
            ))}
          </div>
          <button
            type="button"
            css={styles.chipsClear}
            style={styles.clearButton}
            onClick={onClearFilters}
            data-testid="arreglos-clear-filters"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  searchBarContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
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
    height: "40px",
    width: "44px",
  },
  filterButton: {
    height: "40px",
    width: "48px",
    minWidth: "100px",
  },
  clearButton: {
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
  chipsContainer: css({
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "nowrap",
  }),
  chipsItems: css({
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
  }),
  chipsClear: css({
    marginLeft: "auto",
    flexShrink: 0,
  }),
} as const;


