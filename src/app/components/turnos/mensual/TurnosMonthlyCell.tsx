import React, { useMemo, useState } from "react";
import { Turno } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { toISODateLocal } from "../utils/calendar";

type Props = {
  dia: Date;
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDia?: (d: Date, hora?: string) => void;
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
  const [hoveredTurnoId, setHoveredTurnoId] = useState<string | null>(null);

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
      css={[
        styles.monthCell,
        hovered && styles.monthCellHover,
        isToday && styles.monthCellToday,
        onSelectDia && styles.monthCellClickable,
      ]}
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
      <div css={styles.monthDayNumber}>
        <h2>{dia.getDate()}</h2>
      </div>

      <div css={styles.monthTurnosList}>
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTurno(t);
            }}
            css={[
              styles.monthTurnoItem,
              hoveredTurnoId === t.id && styles.monthTurnoItemHover,
            ]}
            title={`${t.hora} - ${t.vehiculo.modelo}`}
            onMouseEnter={() => {
              setHoveredTurnoId(t.id);
            }}
            onMouseLeave={() => {
              setHoveredTurnoId(null);
            }}
          >
            <span css={styles.monthTurnoHour}>{t.hora}</span>{" "}
            <span css={styles.monthTurnoVehicle}>
              {t.vehiculo.patente} - {t.vehiculo.marca}
            </span>
          </button>
        ))}

        {remaining > 0 ? (
          <div css={styles.monthMoreText}>+{remaining} más</div>
        ) : (
          <div css={styles.monthMoreSpacer} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

const styles = {
  monthCell: css({
    minHeight: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLOR.BORDER.SUBTLE,
    background: COLOR.BACKGROUND.SUBTLE,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    transition: "box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      minHeight: 100,
      padding: 6,
      borderRadius: 0,
      border: "none",
      transition: "box-shadow 120ms ease, transform 120ms ease",
    },
  }),
  monthCellClickable: css({
    cursor: "pointer",
  }),
  monthCellHover: css({
    borderColor: COLOR.ACCENT.PRIMARY,
    boxShadow: "0 6px 14px rgba(17, 17, 17, 0.10)",
    transform: "translateY(-1px)",
  }),
  monthCellToday: css({
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: COLOR.ACCENT.PRIMARY,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      border: "none",
      boxShadow: `inset 0 0 0 2px ${COLOR.ACCENT.PRIMARY}`,
    },
  }),
  monthDayNumber: css({
    fontWeight: 900,
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 1.1,
    h2: {
      margin: 0,
      fontSize: "inherit",
      lineHeight: "inherit",
    },
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      marginBottom: 4,
      fontSize: 13,
    },
  }),
  monthTurnosList: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gap: 1,
    },
  }),
  monthTurnoItem: css({
    width: "100%",
    textAlign: "left",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLOR.BORDER.SUBTLE,
    background: COLOR.BACKGROUND.SECONDARY,
    padding: "6px 8px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    lineHeight: 1.2,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "3px 4px",
      borderRadius: 6,
      fontSize: 7,
      lineHeight: 1.1,
    },
  }),
  monthTurnoHour: css({
    fontWeight: 600,
  }),
  monthTurnoItemHover: css({
    borderColor: COLOR.ACCENT.PRIMARY,
    boxShadow: "0 0px 0px rgba(17, 17, 17, 0.10)",
    transform: "translateY(-1px)",
    transition: "box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease",
  }),
  monthTurnoVehicle: css({
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "bottom",
  }),
  monthMoreText: css({
    marginTop: "auto",
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    paddingTop: 6,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 10,
      paddingTop: 4,
    },
  }),
  monthMoreSpacer: css({
    marginTop: "auto",
    height: 18,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      height: 12,
    },
  }),
} as const;

