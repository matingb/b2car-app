"use client";

import React from "react";
import { useEmpleados, getEmpleadoColor } from "@/app/providers/EmpleadosProvider";
import { getInitials } from "@/lib/initials";


type Props = {
  empleadoId: string | null;
};

export default function EmpleadoChip({ empleadoId }: Props) {
  const { empleados } = useEmpleados();

  const empleado = empleados.find((e) => e.id === empleadoId);
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellido}`.trim() : undefined;
  if (!nombre) return null;

  const color = getEmpleadoColor(empleadoId);

  return (
    <span style={{
      ...styles.chip,
      backgroundColor: color.bg,
      color: color.text,
      borderColor: color.border,
    }}>
      <div style={{
        ...styles.avatar,
        backgroundColor: color.avatarBg,
        color: color.avatarText,
      }}>
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
    border: "1px solid",
    whiteSpace: "nowrap" as const,
  },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 600,
  },
} as const;
