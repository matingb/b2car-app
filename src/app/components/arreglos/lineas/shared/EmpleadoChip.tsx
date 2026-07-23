"use client";

import React from "react";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { getInitials } from "@/lib/initials";
import { COLOR } from "@/theme/theme";

type Props = {
  empleadoId: string | null;
};

export default function EmpleadoChip({ empleadoId }: Props) {
  const { empleados } = useEmpleados();

  const empleado = empleados.find((e) => e.id === empleadoId);
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellido}`.trim() : undefined;
  if (!nombre) return null;

  return (
    <span style={styles.chip}>
      <div style={styles.avatar}>
        {getInitials(nombre)}
      </div>
      {nombre}
    </span>
  );
}

const styles = {
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: 999,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
    whiteSpace: "nowrap" as const,
  },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  },
} as const;
