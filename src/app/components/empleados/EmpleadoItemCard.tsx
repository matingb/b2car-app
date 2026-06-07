"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Empleado } from "@/app/providers/EmpleadosProvider";
import { Building2, CreditCard } from "lucide-react";
import { css } from "@emotion/react";

type Props = {
  empleado: Empleado;
  tallerNombre?: string;
  onClick: () => void;
};

function getInitials(nombre: string, apellido: string) {
  const a = nombre.trim().charAt(0);
  const b = apellido.trim().charAt(0);
  return `${a}${b}`.toUpperCase();
}

function formatSalario(amount: number | null) {
  if (amount === null) return "Sin definir";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function EmpleadoItemCard({ empleado, tallerNombre, onClick }: Props) {
  const initials = getInitials(empleado.nombre, empleado.apellido);

  return (
    <Card onClick={onClick} data-testid={`empleado-item-${empleado.id}`}>
      <div style={styles.container}>
        <div style={styles.leftGroup}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>{initials}</span>
          </div>

          <div style={styles.details}>
            <div style={styles.title}>
              {empleado.nombre} {empleado.apellido}
            </div>
            <div style={styles.subtitleRow}>
              <CreditCard size={13} color={COLOR.TEXT.SECONDARY} />
              <span style={styles.subtitleText}>DNI {empleado.dni}</span>
              {tallerNombre ? (
                <>
                  <span style={styles.metaDot}>•</span>
                  <Building2 size={13} color={COLOR.TEXT.SECONDARY} />
                  <span style={styles.subtitleText}>{tallerNombre}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div css={styles.right}>
          <div style={styles.salarioLabel}>Salario</div>
          <div style={styles.salarioAmount}>{formatSalario(empleado.salario)}</div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  leftGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    cursor: "pointer",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 700,
  },
  details: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  subtitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  subtitleText: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  metaDot: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  },
  right: css({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  salarioLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  salarioAmount: {
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
  },
} as const;
