"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { Turno } from "@/model/types";
import { DIAS_SEMANA } from "@/app/components/turnos/constants";
import { getMonthGrid, toISODateLocal } from "@/app/components/turnos/utils/calendar";
import { COLOR } from "@/theme/theme";
import TurnosMonthlyCell from "@/app/components/turnos/mensual/TurnosMonthlyCell";

type Props = {
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDia?: (d: Date, hora?: string) => void;
};

export default function TurnosMonthlyView({ fechaActual, onSelectTurno, onSelectDia }: Props) {
  const days = useMemo(() => getMonthGrid(fechaActual), [fechaActual]);
  const monthStart = toISODateLocal(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1));
  const monthEnd = toISODateLocal(new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0));

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const { getWithFilters } = useTurnos();
  useEffect(() => {
    const fetchTurnos = async () => {
      const res = await getWithFilters({ from: monthStart, to: monthEnd });
      setTurnos(res);
    };
    fetchTurnos();
  }, [monthStart, monthEnd, getWithFilters]);

  return (
    <Card data-testid="turnos-view-mensual">
      <div style={{ padding: 12 }}>
        <div style={styles.monthGrid}>
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={styles.monthHeaderCell}>
              {d}
            </div>
          ))}

          {days.map((dia, idx) => {
            if (!dia) {
              return <div key={`empty-${idx}`} style={styles.monthEmptyCell} />;
            }

            const turnosDia = turnos.filter((t) => t.fecha === toISODateLocal(dia));
            const iso = toISODateLocal(dia);

            return (
              <TurnosMonthlyCell
                key={iso}
                dia={dia}
                fechaActual={fechaActual}
                onSelectTurno={onSelectTurno}
                onSelectDia={onSelectDia}
                turnosDia={turnosDia}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

const styles = {
  monthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  } as const,
  monthHeaderCell: {
    textAlign: "center" as const,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    padding: 6,
    fontSize: 13,
  } as const,
  monthEmptyCell: {
    minHeight: 140,
    borderRadius: 10,
    border: `1px dashed ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
} as const;
