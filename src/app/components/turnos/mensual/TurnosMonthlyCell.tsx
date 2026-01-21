import React, { useMemo, useState } from "react";
import { Turno } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { toISODateLocal } from "../utils/calendar";

type Props = {
  dia: Date;
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDia?: (d: Date) => void;
  turnosDia: Turno[];
};

export default function TurnosMonthlyCell({
  dia,
  fechaActual,
  onSelectTurno,
  onSelectDia,
  turnosDia,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const visible = turnosDia.slice(0, 3);
  const remaining = Math.max(0, turnosDia.length - visible.length);

  const iso = useMemo(() => toISODateLocal(dia), [dia]);
  const todayISO = useMemo(() => toISODateLocal(new Date()), []); // estable durante el montaje
  const isToday = iso === todayISO;

  const diaWithTime = useMemo(() => {
    const d = new Date(dia);
    d.setHours(
      fechaActual.getHours(),
      fechaActual.getMinutes(),
      fechaActual.getSeconds(),
      fechaActual.getMilliseconds()
    );
    return d;
  }, [dia, fechaActual]);

  return (
    <div
      style={{
        ...styles.monthCell,
        ...(hovered ? styles.monthCellHover : undefined),
        ...(isToday ? styles.monthCellToday : undefined),
        ...(onSelectDia ? styles.monthCellClickable : undefined),
      }}
      data-testid={isToday ? "month-cell-today" : "month-cell"}
      role={onSelectDia ? "button" : undefined}
      tabIndex={onSelectDia ? 0 : undefined}
      onClick={onSelectDia ? () => onSelectDia(diaWithTime) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={
        onSelectDia
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectDia(diaWithTime);
            }
          }
          : undefined
      }
    >
      <div style={styles.monthDayNumber}>
        <h2>{dia.getDate()}</h2>
      </div>

      <div style={styles.monthTurnosList}>
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTurno(t);
            }}
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
}

const styles = {
  monthCell: {
    minHeight: 140,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    padding: 10,
    display: "flex",
    flexDirection: "column" as const,
    transition: "box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease",
  } as const,
  monthCellClickable: {
    cursor: "pointer",
  } as const,
  monthCellHover: {
    borderColor: COLOR.BORDER.DEFAULT,
    boxShadow: "0 6px 14px rgba(17, 17, 17, 0.10)",
    transform: "translateY(-1px)",
  } as const,
  monthCellToday: {
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
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

