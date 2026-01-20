"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { Turno } from "@/model/types";
import { DIAS_SEMANA } from "@/app/components/turnos/constants";
import { getMonthGrid, toISODateLocal } from "@/app/components/turnos/utils/calendar";
import { COLOR } from "@/theme/theme";

type Props = {
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
};

export default function TurnosMonthlyView({ fechaActual, onSelectTurno }: Props) {
  const { getTurnosByDate } = useTurnos();
  const days = useMemo(() => getMonthGrid(fechaActual), [fechaActual]);

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

            const turnosDia = getTurnosByDate(dia);
            const visible = turnosDia.slice(0, 3);
            const remaining = Math.max(0, turnosDia.length - visible.length);

            return (
              <div key={toISODateLocal(dia)} style={styles.monthCell}>
                <div style={styles.monthDayNumber}><h2>{dia.getDate()}</h2></div>

                <div style={styles.monthTurnosList}>
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTurno(t)}
                      style={styles.monthTurnoItem}
                      title={`${t.hora} - ${t.vehiculo.modelo}`}
                    >
                      <span style={{ fontWeight: 800 }}>{t.hora}</span>{" "}
                      <span style={styles.monthTurnoVehicle}>
                        {t.vehiculo.patente} - {t.vehiculo.marca}
                      </span>
                    </button>
                  ))}

                  {remaining > 0 ? (
                    <div style={styles.monthMoreText}>+{remaining} más</div>
                  ) : (
                    <div style={styles.monthMoreSpacer} aria-hidden="true" />
                  )}
                </div>
              </div>
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
  monthCell: {
    minHeight: 140,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    padding: 10,
    display: "flex",
    flexDirection: "column" as const,
  } as const,
  monthDayNumber: {
    fontWeight: 900,
    marginBottom: 8,
  } as const,
  monthTurnosList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    flex: 1,
  } as const,
  monthTurnoItem: {
    width: "100%",
    textAlign: "left" as const,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    padding: "6px 8px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    overflow: "hidden",
  } as const,
  monthTurnoVehicle: {
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "bottom" as const,
  } as const,
  monthMoreText: {
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    paddingTop: 6,
  } as const,
  monthMoreSpacer: {
    marginTop: "auto",
    height: 18,
  } as const,
} as const;
