import React from "react";
import { CalendarClock } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import DefinitionItem from "@/app/components/ui/DefinitionItem";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = { empleado: Empleado };

function formatDate(iso: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatSalario(amount: number | null): string {
  if (amount === null) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function EmpleadoInfoPersonalCard({ empleado }: Props) {
  return (
    <div style={styles.main}>
      <div style={styles.header}>
        <h3 style={styles.title}>Datos laborales</h3>
      </div>
      <Card style={styles.contentPanel}>
        <div css={styles.grid}>
          <DefinitionItem
            label="Salario actual"
            value={formatSalario(empleado.salario)}
          />
          <DefinitionItem
            label="Fecha de ingreso"
            value={formatDate(empleado.fechaIngreso)}
            icon={<CalendarClock size={14} color={COLOR.TEXT.SECONDARY} />}
          />
        </div>
      </Card>
    </div>
  );
}

const styles = {
  main: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
    height: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 20,
    marginBottom: 8,
    fontWeight: 600,
    
  },
  title: {
    margin: 0,
    height: 34,
    display: "flex",
    alignItems: "flex-end",

  },
  contentPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    width: "100%",
    height: "100%",
  },
  grid: css({
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
} as const;
