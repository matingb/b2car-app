"use client";

import React from "react";
import { useEmpleados, getEmpleadoColor } from "@/app/providers/EmpleadosProvider";
import { getInitials } from "@/lib/initials";


import { formatArs } from "@/lib/format";

type Props = {
  empleadoId: string | null;
  showMontoHoras?: boolean;
  rate?: number | null;
};

export default function EmpleadoChip({ empleadoId, showMontoHoras = false, rate = null }: Props) {
  const { empleados } = useEmpleados();

  const empleado = empleados.find((e) => e.id === empleadoId);
  if (!empleado) return null;
  const nombre = `${empleado.nombre} ${empleado.apellido}`.trim();
  if (!nombre) return null;

  const color = getEmpleadoColor(empleadoId);
  const effectiveRate = rate ?? (empleado.salario != null && empleado.salario > 0 ? empleado.salario : null);
  const displayText =
    showMontoHoras && effectiveRate != null && effectiveRate > 0
      ? `${nombre} · ${formatArs(effectiveRate, { maxDecimals: 0, minDecimals: 0 })}/h`
      : nombre;

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
      {displayText}
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
