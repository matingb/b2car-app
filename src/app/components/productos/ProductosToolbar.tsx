"use client";

import React, { useState } from "react";
import SearchBar from "@/app/components/ui/SearchBar";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";
import Toggle from "@/app/components/ui/Toggle";
import { Download, LoaderCircle, PlusIcon } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { productosClient } from "@/clients/productosClient";
import { useToast } from "@/app/providers/ToastProvider";

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
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportStock = async () => {
    setIsExporting(true);
    try {
      const { error } = await productosClient.exportStockExcel();
      if (error) {
        toast.error("Error al exportar", error);
      } else {
        toast.success("Excel descargado", "El stock de productos se descargó correctamente.");
      }
    } catch {
      toast.error("Error al exportar", "Ocurrió un error inesperado al descargar el archivo.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div css={styles.container}>
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar productos..."
        style={styles.search}
      />

      <div css={styles.filtersRow}>
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

        <div css={styles.actionsRow}>
          <label css={styles.sporadicToggle}>
            <Toggle
              checked={showEsporadicos}
              onChange={onShowEsporadicosChange}
              label="Mostrar esporádicos"
            />
            <span>Esporádicos</span>
          </label>

          <div css={styles.actionButtons}>
            <IconButton
              icon={isExporting ? <LoaderCircle className="animate-spin" size={20} /> : <Download size={20} />}
              title="Descargar inventario en Excel"
              ariaLabel="Descargar inventario en Excel"
              onClick={handleExportStock}
              disabled={isExporting}
              style={styles.exportButton}
              hoverColor={COLOR.TEXT.PRIMARY}
              data-testid="productos-export-excel-btn"
            />

            <Button
              icon={<PlusIcon size={20} />}
              text="Nuevo producto"
              onClick={onNewProductClick}
              style={styles.newButton}
            />
          </div>
        </div>
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
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      alignItems: "stretch",
      flexDirection: "column",
    },
  }),
  categoriesSelect: css({
    width: 200,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: "100%",
    },
  }),
  categoriesInput: {
    height: 40,
    paddingTop: 9,
    paddingBottom: 9,
  },
  actionsRow: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: "100%",
      justifyContent: "space-between",
    },
  }),
  actionButtons: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  }),
  sporadicToggle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
    flexShrink: 0,
  }),
  exportButton: {
    height: 40,
    width: 40,
    minWidth: 40,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    flexShrink: 0,
  },
  newButton: {
    height: 40,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
} as const;
