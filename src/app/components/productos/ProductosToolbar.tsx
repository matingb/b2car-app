"use client";

import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import FilterChip from "@/app/components/ui/FilterChip";
import { Filter } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import type { ProductosChip, ProductosChipKind } from "@/app/hooks/productos/useProductosFilters";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  chips: ProductosChip[];
  onChipClick: (kind: ProductosChipKind) => void;
  onClearFilters: () => void;
  style?: React.CSSProperties;
};

export default function ProductosToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  chips,
  onChipClick,
  onClearFilters,
  style,
}: Props) {
  return (
    <div style={{ ...styles.container, ...(style ?? {}) }}>
      <div style={styles.row}>
        <SearchBar value={search} onChange={onSearchChange} placeholder="Buscar productos..." style={styles.search} />
        <Button icon={<Filter size={20} />} text="Filtrar" onClick={onOpenFilters} style={styles.filterButton} outline />
      </div>

      {chips.length > 0 && (
        <div css={styles.chipsContainer} aria-label="Filtros aplicados" data-testid="productos-active-filters">
          <div css={styles.chipsItems}>
            {chips.map((chip) => (
              <FilterChip key={chip.key} text={chip.text} onClick={() => onChipClick(chip.kind)} />
            ))}
          </div>
          <button type="button" css={styles.chipsClear} style={styles.clearButton} onClick={onClearFilters}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  search: {
    width: "100%",
    flex: 1,
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

