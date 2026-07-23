"use client";

import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";
import Toggle from "@/app/components/ui/Toggle";
import { PlusIcon } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  categoriasDisponibles: readonly string[];
  categorias: string[];
  onCategoriasChange: (categorias: string[]) => void;
  showEsporadicos: boolean;
  onShowEsporadicosChange: (checked: boolean) => void;
  onNewProductClick?: () => void;
};

export default function ProductosToolbar({
  search,
  onSearchChange,
  categoriasDisponibles,
  categorias,
  onCategoriasChange,
  showEsporadicos,
  onShowEsporadicosChange,
  onNewProductClick,
}: Props) {
  return (
    <div css={styles.container}>
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar productos..."
        style={styles.search}
      />

      <div css={styles.filtersRow}>
        <label css={styles.sporadicToggle}>
          <Toggle
            checked={showEsporadicos}
            onChange={onShowEsporadicosChange}
            label="Mostrar esporádicos"
          />
          <span>Esporádicos</span>
        </label>

        <div css={styles.categoriesSelect}>
          <DropdownMultiSelect
            options={categoriasDisponibles.map((categoria) => ({ value: categoria, label: categoria }))}
            value={categorias}
            onChange={onCategoriasChange}
            placeholder="Categorías"
            clearable={false}
            clearOptionLabel="Todas"
            inputStyle={styles.categoriesInput}
          />
        </div>

        <Button
          icon={<PlusIcon size={20} />}
          text="Nuevo producto"
          onClick={onNewProductClick}
          style={styles.newButton}
        />
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      alignItems: "stretch",
      flexDirection: "column",
    },
  }),
  search: {
    width: "100%",
    flex: 1,
  },
  filtersRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      alignItems: "stretch",
      flexDirection: "column",
    },
  }),
  sporadicToggle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  }),
  categoriesSelect: css({
    width: 200,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
    },
  }),
  categoriesInput: {
    height: 40,
    paddingTop: 9,
    paddingBottom: 9,
  },
  newButton: {
    height: 40,
    whiteSpace: "nowrap" as const,
  },
} as const;
