"use client";

import React, { CSSProperties } from "react";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useTenant } from "@/app/providers/TenantProvider";
import { COLOR } from "@/theme/theme";

export type TallerSelectorProps = {
  /**
   * Si se especifica, agrega una primera opción para seleccionar la vista global / todos.
   * Ejemplo: allOption="Vista general" o allOption="Todos los talleres"
   */
  allOption?: string;

  /**
   * Valor seleccionado (opcional, si no se pasa usa el tallerSeleccionadoId de useTenant)
   */
  value?: string;

  /**
   * Callback al cambiar de taller (opcional, si no se pasa usa setTallerSeleccionadoId de useTenant)
   */
  onChange?: (tallerId: string) => void;

  /**
   * Estilos del contenedor
   */
  style?: CSSProperties;

  /**
   * data-testid para testing
   */
  dataTestId?: string;
};

export default function TallerSelector({
  allOption,
  value,
  onChange,
  style,
  dataTestId = "taller-selector",
}: TallerSelectorProps) {
  const tenant = useTenant();
  const talleres = tenant.talleres;

  if (talleres.length <= 1) {
    return null;
  }

  const currentValue = value !== undefined ? value : tenant.tallerSeleccionadoId;
  const handleChange = onChange ?? tenant.setTallerSeleccionadoId;

  const options = [
    ...(allOption ? [{ value: "", label: allOption }] : []),
    ...talleres.map((t) => ({ value: t.id, label: t.nombre })),
  ];

  return (
    <div style={{ ...styles.container, ...style }}>
      <div style={styles.label}>Taller</div>
      <Autocomplete
        value={currentValue}
        options={options}
        onChange={handleChange}
        style={styles.autocomplete}
        hideClearButton
        dataTestId={dataTestId}
      />
    </div>
  );
}

const styles = {
  container: {
    marginTop: 12,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  autocomplete: {
    height: 40,
    width: "280px",
    padding: "0 12px",
  },
} as const;
