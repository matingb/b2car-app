import React from "react";
import { Briefcase } from "lucide-react";
import { COLOR } from "@/theme/theme";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = {
  empleado: Empleado;
  tallerNombre: string;
};

function getInitials(nombre: string, apellido: string) {
  return `${nombre.trim().charAt(0)}${apellido.trim().charAt(0)}`.toUpperCase();
}

export default function EmpleadoProfileCard({ empleado, tallerNombre }: Props) {
  const initials = getInitials(empleado.nombre, empleado.apellido);

  return (
    <div style={styles.card}>
      <div style={styles.banner} />
      <div style={styles.body}>
        <div style={styles.avatar}>
          <span style={styles.avatarText}>{initials}</span>
        </div>
        <div style={styles.titleBlock}>
          <h2 style={styles.name}>
            {empleado.nombre} {empleado.apellido}
          </h2>
          <div style={styles.subtitleRow}>
            <Briefcase size={14} color={COLOR.TEXT.SECONDARY} />
            {tallerNombre && <span style={styles.subtitleText}>{tallerNombre}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden",
  },
  banner: {
    height: 64,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  body: {
    padding: "0 20px 20px",
    display: "flex",
    alignItems: "flex-end",
    gap: 16,
    marginTop: -32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.SECONDARY,
    border: `4px solid ${COLOR.BACKGROUND.SECONDARY}`,
    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 700,
    background: COLOR.BACKGROUND.INFO_TINT,
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.ACCENT.PRIMARY,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    paddingBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 600,
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
