"use client";

import React from "react";
import { useTiposArreglo } from "@/app/providers/TiposArregloProvider";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";

type Props = {
  tipoArregloId: string | null;
  empleadoId: string | null;
};

// Helper for initials
function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TipoEmpleadoChips({ tipoArregloId, empleadoId }: Props) {
  const { tipos } = useTiposArreglo();
  const { empleados } = useEmpleados();

  const tipoNombre = tipos.find((t) => t.id === tipoArregloId)?.nombre;
  const empleado = empleados.find((e) => e.id === empleadoId);
  const empleadoNombre = empleado ? `${empleado.nombre} ${empleado.apellido}`.trim() : undefined;

  if (!tipoNombre && !empleadoNombre) return null;

  return (
    <span style={styles.wrap}>
      {tipoNombre ? (
        <span style={styles.tipoChip}>
          {tipoNombre}
        </span>
      ) : null}
      {empleadoNombre ? (
        <span style={styles.empleadoChip}>
          <div style={styles.empleadoAvatar}>
            {getInitials(empleadoNombre)}
          </div>
          {empleadoNombre}
        </span>
      ) : null}
    </span>
  );
}

const styles = {
  wrap: {
    display: "inline-flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  tipoChip: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#f1f5f9", // slate-100
    color: "#475569", // slate-600
    whiteSpace: "nowrap" as const,
  },
  empleadoChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff", // indigo-50
    color: "#4338ca", // indigo-700
    whiteSpace: "nowrap" as const,
  },
  empleadoAvatar: {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: "#c7d2fe", // indigo-200
    color: "#3730a3", // indigo-800
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  }
} as const;
