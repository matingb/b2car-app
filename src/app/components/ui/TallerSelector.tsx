"use client";

import React, { CSSProperties } from "react";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useTenant } from "@/app/providers/TenantProvider";
import { COLOR } from "@/theme/theme";
import type { Taller } from "@/model/types";

export type TallerSelectorProps = {
  /**
   * Si se especifica, agrega una primera opción para seleccionar la vista global / todos.
   * Ejemplo: allOption="Vista general" o allOption="Todos los talleres"
   */
  allOption?: string;

  /**
   * Lista de talleres opcional. Si no se provee, se obtienen de useTenant().
   */
  talleres?: Array<Pick<Taller, "id" | "nombre">>;

  /**
   * Valor seleccionado (opcional, si no se pasa usa el tallerSeleccionadoId de useTenant)
   */
  value?: string;

  /**
   * Callback al cambiar de taller (opcional, si no se pasa usa setTallerSeleccionadoId de useTenant)
   */
  onChange?: (tallerId: string) => void;

  /**
   * Placeholder del input
   */
  placeholder?: string;

  /**
   * Disposición del selector:
   * - "horizontal" (default): label a la izquierda, ideal para barras de filtro
   * - "vertical": label arriba y ancho completo, ideal para formularios y modales
   */
  layout?: "horizontal" | "vertical";

  /**
   * Estilos del contenedor
   */
  style?: CSSProperties;

  /**
   * Estilos específicos para el autocomplete
   */
  autocompleteStyle?: CSSProperties;

  /**
   * Estilos específicos para el label
   */
  labelStyle?: CSSProperties;

  /**
   * data-testid para testing
   */
  dataTestId?: string;
};

export default function TallerSelector({
  allOption,
  talleres: talleresProp,
  value,
  onChange,
  placeholder = "Seleccionar taller",
  layout = "horizontal",
  style,
  autocompleteStyle,
  labelStyle,
  dataTestId = "taller-selector",
}: TallerSelectorProps) {
  let tenant: ReturnType<typeof useTenant> | null = null;
  try {
    tenant = useTenant();
  } catch {
    // Soporte para uso fuera de TenantProvider cuando se pasa talleresProp
  }

  const talleres = talleresProp ?? tenant?.talleres;

  if (!talleres) {
    throw new Error("useTenant debe usarse dentro de TenantProvider o proveer la prop 'talleres'");
  }

  if (talleres.length <= 1) {
    return null;
  }

  const currentValue = value !== undefined ? value : (tenant?.tallerSeleccionadoId ?? "");
  const handleChange = onChange ?? tenant?.setTallerSeleccionadoId ?? (() => {});

  const options = [
    ...(allOption ? [{ value: "", label: allOption }] : []),
    ...talleres.map((t) => ({ value: t.id, label: t.nombre })),
  ];

  const isVertical = layout === "vertical";
  const containerStyle = isVertical ? styles.verticalContainer : styles.horizontalContainer;
  const resolvedLabelStyle = isVertical ? styles.verticalLabel : styles.horizontalLabel;
  const resolvedAutocompleteStyle = isVertical ? styles.verticalAutocomplete : styles.horizontalAutocomplete;

  return (
    <div style={{ ...containerStyle, ...style }}>
      <div style={{ ...resolvedLabelStyle, ...labelStyle }}>Taller</div>
      <Autocomplete
        value={currentValue}
        options={options}
        onChange={handleChange}
        placeholder={placeholder}
        style={{ ...resolvedAutocompleteStyle, ...autocompleteStyle }}
        hideClearButton
        dataTestId={dataTestId}
      />
    </div>
  );
}

const styles = {
  horizontalContainer: {
    marginTop: 12,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  horizontalLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  horizontalAutocomplete: {
    height: 40,
    width: "280px",
    padding: "0 12px",
  },
  verticalContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    width: "100%",
  },
  verticalLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 400,
  },
  verticalAutocomplete: {
    height: 44,
    width: "100%",
    fontSize: 14,
  },
} as const;
