"use client";

import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import FilterChip from "@/app/components/ui/FilterChip";
import { Filter, PlusIcon } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import type {
  EmpleadosChip,
  EmpleadosChipKind,
} from "@/app/hooks/empleados/useEmpleadosFilters";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  chips: EmpleadosChip[];
  onChipClick: (kind: EmpleadosChipKind) => void;
  onNewEmpleadoClick?: () => void;
  onClearFilters: () => void;
  style?: React.CSSProperties;
};

export default function EmpleadosToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  chips,
  onChipClick,
  onClearFilters,
  onNewEmpleadoClick,
  style,
}: Props) {
  return (
    <div style={{ ...styles.container, ...(style ?? {}) }}>
      <div style={styles.row}>
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por nombre, DNI o email..."
          style={styles.search}
        />
        <Button
          icon={<Filter size={20} />}
          text="Filtrar"
          onClick={onOpenFilters}
          style={styles.filterButton}
          outline
        />
        <Button
          icon={<PlusIcon size={20} />}
          text="Nuevo empleado"
          onClick={onNewEmpleadoClick}
          style={{ height: 40 }}
        />
      </div>

      {chips.length > 0 && (
        <div
          css={styles.chipsContainer}
          aria-label="Filtros aplicados"
          data-testid="empleados-active-filters"
        >
          <div css={styles.chipsItems}>
            {chips.map((chip) => (
              <FilterChip key={chip.key} text={chip.text} onClick={() => onChipClick(chip.kind)} />
            ))}
          </div>
          <button
            type="button"
            css={styles.chipsClear}
            style={styles.clearButton}
            onClick={onClearFilters}
          >
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
