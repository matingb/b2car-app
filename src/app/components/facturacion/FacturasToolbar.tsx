"use client";

import React from "react";
import { css } from "@emotion/react";
import { Filter } from "lucide-react";
import Button from "@/app/components/ui/Button";
import FilterChip from "@/app/components/ui/FilterChip";
import SearchBar from "@/app/components/ui/SearchBar";
import { COLOR } from "@/theme/theme";

export type FacturaFilterChip = {
  key: string;
  text: string;
};

export type FacturaDocumentoTipoFilter = "" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  documentoTipo: FacturaDocumentoTipoFilter;
  onDocumentoTipoChange: (value: FacturaDocumentoTipoFilter) => void;
  chips: FacturaFilterChip[];
  onRemoveChip: (key: string) => void;
  onClearFilters: () => void;
};

export default function FacturasToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  documentoTipo,
  onDocumentoTipoChange,
  chips,
  onRemoveChip,
  onClearFilters,
}: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por receptor, documento o CAE..."
          inputTestId="facturas-search"
          style={styles.search}
        />
        <Button
          icon={<Filter size={20} />}
          text="Filtrar"
          onClick={onOpenFilters}
          style={styles.filterButton}
          dataTestId="facturas-open-filters"
          outline
          hideTextOnMobile={false}
        />
      </div>

      <div css={styles.documentTypeChips} aria-label="Filtrar por tipo de documento">
        <span style={styles.documentTypeLabel}>Tipo de documento</span>
        {([
          ["", "Todos"],
          ["FACTURA", "Facturas"],
          ["NOTA_CREDITO", "Notas de crédito"],
          ["NOTA_DEBITO", "Notas de débito"],
        ] as const).map(([value, label]) => (
          <FilterChip
            key={value || "TODOS"}
            text={label}
            selected={documentoTipo === value}
            onClick={() => onDocumentoTipoChange(value)}
          />
        ))}
      </div>

      {chips.length ? (
        <div css={styles.chipsContainer} aria-label="Filtros aplicados" data-testid="facturas-active-filters">
          <div css={styles.chipsItems}>
            {chips.map((chip) => <FilterChip key={chip.key} text={chip.text} onClick={() => onRemoveChip(chip.key)} />)}
          </div>
          <button type="button" css={styles.clear} style={styles.clearButton} onClick={onClearFilters} data-testid="facturas-clear-filters">
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 16 },
  row: { display: "flex", gap: 12, alignItems: "center" },
  search: { width: "100%", flex: 1, height: 40 },
  filterButton: { height: 40, minWidth: 108 },
  documentTypeChips: css({ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }),
  documentTypeLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 600, marginRight: 2 },
  chipsContainer: css({ display: "flex", gap: "10px", alignItems: "center", flexWrap: "nowrap" }),
  chipsItems: css({ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1, minWidth: 0 }),
  clear: css({ marginLeft: "auto", flexShrink: 0 }),
  clearButton: {
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
} as const;
