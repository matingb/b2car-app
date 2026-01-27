"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Pill from "@/app/components/turnos/Pill";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { Turno } from "@/model/types";
import { DIAS_SEMANA } from "@/app/components/turnos/constants";
import {
  horaAMinutos,
  isSameLocalDay,
  toISODateLocal,
  getWeekDays,
} from "@/app/components/turnos/utils/calendar";
import { estadoAccentColor } from "@/app/components/turnos/utils/estado";
import { COLOR } from "@/theme/theme";
import TurnosWeeklySlotCell from "@/app/components/turnos/semanal/TurnosWeeklySlotCell";
import { logger } from "@/lib/logger";

const HORA_INICIO = 8;
const HORA_COLUMNAS = 12; // 08:00 -> 19:00
const HORA_COL_WIDTH = 100;
const ALTO_FILA_DIA = 150;

function organizarTurnosEnColumnas(turnos: Turno[]) {
  const turnosOrdenados = [...turnos].sort(
    (a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora)
  );
  const columnas: Turno[][] = [];

  turnosOrdenados.forEach((turno) => {
    const inicio = horaAMinutos(turno.hora);

    let assigned = false;
    for (let i = 0; i < columnas.length; i++) {
      const lastInCol = columnas[i][columnas[i].length - 1];
      const lastFin = horaAMinutos(lastInCol.hora) + (lastInCol.duracion || 15);
      if (inicio >= lastFin) {
        columnas[i].push(turno);
        assigned = true;
        break;
      }
    }
    if (!assigned) columnas.push([turno]);
  });

  return columnas;
}

type Props = {
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDia?: (d: Date, hora?: string) => void;
};

export default function TurnosWeeklyGridHView({
  fechaActual,
  onSelectTurno,
  onSelectDia,
}: Props) {
  const { getWithFilters } = useTurnos();
  const [hoveredTurnoId, setHoveredTurnoId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const dias = useMemo(() => getWeekDays(fechaActual), [fechaActual]);
  const horas = useMemo(
    () => Array.from({ length: HORA_COLUMNAS }, (_, i) => i + HORA_INICIO),
    []
  );
  const weekStart = toISODateLocal(dias[0]);
  const weekEnd = toISODateLocal(dias[6]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowLeftPx = (nowMinutes / 60 - HORA_INICIO) * HORA_COL_WIDTH;
  const showNowLine =
    nowMinutes >= HORA_INICIO * 60 &&
    nowMinutes <= (HORA_INICIO + HORA_COLUMNAS) * 60;
  
  useEffect(() => {
    const fetchTurnos = async () => {
      const res = await getWithFilters({ from: toISODateLocal(dias[0]), to: toISODateLocal(dias[6]) });
      setTurnos(res);
    };
    fetchTurnos();
  }, [weekStart, weekEnd, getWithFilters, dias]);



  return (
    <div data-testid="turnos-view-semanal">
      <Card>
        <div style={{ padding: 0 }}>
        <div style={styles.scrollX}>
          <div style={styles.weekGridRoot}>
            <div style={styles.weekGridHeaderRow}>
              <div style={styles.weekGridDayHeaderCell}>
                <div style={styles.mutedSmall}>Día</div>
              </div>
              {horas.map((h) => (
                <div key={h} style={styles.weekGridHourHeaderCell}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                </div>
              ))}
            </div>

            <div>
              {dias.map((dia, idx) => {
                const turnosDia = turnos.filter((t) => t.fecha === toISODateLocal(dia));
                const columnas = organizarTurnosEnColumnas(turnosDia);
                const colCount = Math.max(1, columnas.length);
                let altoPorCol = ALTO_FILA_DIA / colCount;
                if (colCount > 3) altoPorCol = altoPorCol * 1.30; // Capaz habria que repensar como se dibujan los bloques de cada turno

                return (
                  <div key={toISODateLocal(dia)} style={{...styles.weekGridDayRow, height: altoPorCol * colCount}}>
                    <div style={styles.weekGridDayCell}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {DIAS_SEMANA[idx]}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        <h1>
                        {dia.getDate()}
                        </h1>
                      </div>
                      <div style={styles.mutedSmall}>
                        {turnosDia.length} turnos
                      </div>
                    </div>

                    <div style={styles.weekGridTimelineCell}>
                      {isSameLocalDay(dia, now) && showNowLine ? (
                        <div
                          style={{
                            ...styles.nowLineVertical,
                            left: nowLeftPx,
                          }}
                          aria-hidden="true"
                        />
                      ) : null}

                      {horas.map((h) => (
                        <TurnosWeeklySlotCell
                          key={`${toISODateLocal(dia)}-${h}`}
                          dia={dia}
                          hour={h}
                          width={HORA_COL_WIDTH}
                          onSelectDia={onSelectDia}
                        />
                      ))}

                      {turnosDia.length > 0
                        ? columnas.map((columna, colIndex) => {
                            return (
                              <div key={colIndex} style={styles.absoluteFill}>
                                {columna.map((turno) => {
                                  const inicioMin = horaAMinutos(turno.hora);
                                  const inicioH = Math.floor(inicioMin / 60);
                                  const inicioM = inicioMin % 60;
                                  const leftPx =
                                    (inicioH - HORA_INICIO) * HORA_COL_WIDTH +
                                    (inicioM / 60) * HORA_COL_WIDTH;
                                  const widthPx =
                                    ((turno.duracion || 15) / 60) * HORA_COL_WIDTH;

                                  if (leftPx + widthPx <= 0) return null;

                                  const top = colIndex * altoPorCol + 6;
                                  const height = altoPorCol - 12;

                                  return (
                                    <div
                                      key={turno.id}
                                      onClick={() => onSelectTurno(turno)}
                                      style={{
                                        ...styles.turnoBlockBase,
                                        ...(hoveredTurnoId === turno.id
                                          ? styles.turnoBlockHover
                                          : undefined),
                                        borderLeftColor: estadoAccentColor(turno.estado),
                                        left: leftPx,
                                        width: Math.max(100, widthPx - 6),
                                        top,
                                        height,
                                      }}
                                      onMouseEnter={() => setHoveredTurnoId(turno.id)}
                                      onMouseLeave={() => setHoveredTurnoId(null)}
                                      role="button"
                                      aria-label={`Turno ${turno.hora} ${turno.vehiculo}`}
                                    >
                                      <div style={styles.turnoBlockTopRow}>
                                        <span style={styles.turnoHora}>
                                          {turno.vehiculo.patente} - {turno.hora}
                                        </span>
                                      </div>
                                      <div style={styles.turnoVehiculo}>
                                        {turno.vehiculo.marca} {turno.vehiculo.modelo}
                                      </div>
                                      <div style={styles.turnoTitular}>
                                        {turno.cliente.nombre}
                                      </div>
                                      <div style={styles.turnoBottomRow}>
                                        <Pill text={turno.tipo || "Sin tipo"} />
                                        <span style={styles.turnoDuracion}>
                                          {turno.duracion}min
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </Card>
    </div>
  );
}

const styles = {
  scrollX: {
    width: "100%",
    overflowX: "auto" as const,
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch" as const,
    overscrollBehaviorX: "contain" as const,
  },
  weekGridRoot: {
    display: "inline-block",
    width: "max-content",
    minWidth: "100%",
  } as const,
  weekGridHeaderRow: {
    display: "flex",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
  },
  weekGridDayHeaderCell: {
    width: 125,
    flexShrink: 0,
    padding: "10px 12px",
    borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  weekGridHourHeaderCell: {
    width: HORA_COL_WIDTH,
    flexShrink: 0,
    padding: "10px 12px",
    textAlign: "center" as const,
    borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  weekGridDayRow: {
    display: "flex",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  weekGridDayCell: {
    width: 125,
    flexShrink: 0,
    padding: "12px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  weekGridTimelineCell: {
    position: "relative" as const,
    display: "flex",
    minHeight: ALTO_FILA_DIA,
  } as const,
  absoluteFill: {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
  } as const,
  turnoBlockBase: {
    position: "absolute" as const,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderTopColor: COLOR.BORDER.SUBTLE,
    borderRightColor: COLOR.BORDER.SUBTLE,
    borderBottomColor: COLOR.BORDER.SUBTLE,
    borderLeftWidth: 4,
    borderLeftStyle: "solid" as const,
    borderLeftColor: "transparent",
    background: COLOR.BACKGROUND.SUBTLE,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    cursor: "pointer",
    overflow: "hidden",
    transition: "transform 120ms ease, box-shadow 120ms ease",
    pointerEvents: "auto" as const,
  } as const,
  turnoBlockHover: {
    borderTopColor: COLOR.ACCENT.PRIMARY,
    borderRightColor: COLOR.ACCENT.PRIMARY,
    borderBottomColor: COLOR.ACCENT.PRIMARY,
    borderLeftColor: COLOR.ACCENT.PRIMARY,
    boxShadow: "0 4px 16px rgba(17, 17, 17, 0.10)",
    transform: "translateY(-1px)",
    transition: "box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease",
  } as const,
  turnoBlockTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  turnoHora: {
    fontWeight: 700,
    fontSize: 13,
  },
  turnoVehiculo: {
    marginTop: 6,
    fontWeight: 400,
    fontSize: 13,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  turnoTitular: {
    marginTop: 2,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  turnoBottomRow: {
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  turnoDuracion: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  mutedSmall: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  } as const,
  nowLineVertical: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: 2,
    background: COLOR.ICON.DANGER,
    zIndex: 3,
    pointerEvents: "none" as const,
  } as const,
} as const;

