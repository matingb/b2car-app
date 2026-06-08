import React from "react";
import { Building2 } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Avatar from "@/app/components/ui/Avatar";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = {
  empleado: Empleado;
  tallerNombre: string;
};

export default function EmpleadoProfileCard({ empleado, tallerNombre }: Props) {
  const nombreCompleto = `${empleado.nombre} ${empleado.apellido}`.trim();

  return (
    <div style={styles.header}>
      <Avatar nombre={nombreCompleto} size={60} />
      <div style={styles.titleBlock}>
        <h1 style={styles.name}>{nombreCompleto}</h1>
        <div style={styles.subtitleRow}>
          <Building2 size={14} color={COLOR.TEXT.SECONDARY} />
          {tallerNombre && <span style={styles.subtitleText}>{tallerNombre}</span>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
    marginTop: 12,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
  },
  subtitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  subtitleText: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
} as const;
