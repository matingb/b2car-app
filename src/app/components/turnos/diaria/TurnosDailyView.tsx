"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import Pill from "@/app/components/turnos/Pill";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { Turno } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { CalendarDays } from "lucide-react";
import { horaAMinutos, isSameLocalDay } from "@/app/components/turnos/utils/calendar";

function detectarSuperposiciones(turnos: Turno[]) {
  const turnosOrdenados = [...turnos].sort(
    (a, b) => horaAMinutos(a.hora) - horaAMinutos(b.hora)
  );
  const grupos: Turno[][] = [];

  turnosOrdenados.forEach((turno) => {
    const inicio = horaAMinutos(turno.hora);
    const fin = inicio + (turno.duracion || 60);

    let agregado = false;
    for (const grupo of grupos) {
      const superpone = grupo.some((t) => {
        const tInicio = horaAMinutos(t.hora);
        const tFin = tInicio + (t.duracion || 60);
        return inicio < tFin && fin > tInicio;
      });
      if (superpone) {
        grupo.push(turno);
        agregado = true;
        break;
      }
    }
    if (!agregado) grupos.push([turno]);
  });

  return { turnosOrdenados, grupos };
}

type Props = {
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
};

export default function TurnosDailyView({ fechaActual, onSelectTurno }: Props) {
  const { getTurnosByDate } = useTurnos();
  const turnosDelDia = useMemo(
    () => getTurnosByDate(fechaActual),
    [fechaActual, getTurnosByDate]
  );

  const { turnosOrdenados, grupos } = useMemo(
    () => detectarSuperposiciones(turnosDelDia),
    [turnosDelDia]
  );

  const horas = useMemo(() => Array.from({ length: 16 }, (_, i) => i + 6), []);

  const now = new Date();
  const isToday = isSameLocalDay(fechaActual, now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = nowMinutes - 6 * 60; // px desde 06:00 (1min = 1px)
  const showNowLine = isToday && nowMinutes >= 6 * 60 && nowMinutes <= 21 * 60;

  if (turnosDelDia.length === 0) {
    return (
      <div data-testid="turnos-view-diaria">
        <Card>
          <div style={styles.emptyState}>
            <CalendarDays size={40} color={COLOR.TEXT.SECONDARY} />
            <div style={{ marginTop: 10, color: COLOR.TEXT.SECONDARY }}>
              No hay turnos programados para este día
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="turnos-view-diaria">
      <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <Card>
        <div style={{ padding: 12 }}>
          <div style={styles.timelineRoot}>
            {showNowLine ? (
              <div
                style={{
                  ...styles.nowLineHorizontal,
                  top: nowTop,
                }}
                aria-hidden="true"
              />
            ) : null}

            <div style={styles.timelineGrid}>
              {horas.map((h) => (
                <div key={h} style={styles.timelineRow}>
                  <div style={styles.timelineHourLabel}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                  <div style={styles.timelineHourCell}>
                    <div style={styles.timelineHalfLine} />
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.timelineOverlay} aria-label="Turnos en timeline">
              {grupos.map((grupo) => {
                const columns = Math.max(1, grupo.length);
                return grupo.map((turno, idx) => {
                  const inicioMin = horaAMinutos(turno.hora);
                  const topOffset =
                    (Math.floor(inicioMin / 60) - 6) * 60 + (inicioMin % 60);
                  const height = Math.max(60, (turno.duracion || 0));
                  const width = `${100 / columns - 1}%`;
                  const left = `${(idx * 100) / columns+0.5}%`;

                  // “tamaños para no cortar datos”: si la caja es baja,
                  // truncamos y omitimos líneas menos importantes.
                  const showTitular = height >= 88;
                  const showBottom = height >= 120;

                  return (
                    <div
                      key={turno.id}
                      onClick={() => onSelectTurno(turno)}
                      style={{
                        ...styles.timelineTurno,
                        top: topOffset,
                        height,
                        width,
                        left,
                      }}
                      role="button"
                      aria-label={`Turno ${turno.hora} ${turno.vehiculo}`}
                    >
                      <div style={styles.tlHora}>{turno.hora}</div>
                      <div style={styles.tlVehiculo} title={turno.vehiculo.modelo}>
                        {turno.vehiculo.marca} {turno.vehiculo.modelo}
                      </div>
                      {showTitular ? (
                        <div style={styles.tlTitular} title={turno.cliente.nombre}>
                          {turno.cliente.nombre}
                        </div>
                      ) : null}
                      {showBottom ? (
                        <div style={styles.timelineTurnoBottom}>
                          <Pill text={turno.tipo || "Sin tipo"} />
                          {turno.duracion != null ? (
                            <span style={styles.tlDuracion}>
                              {turno.duracion}min
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 12 }}>
          <div style={styles.dayListHeaderRow}>
            <div style={{ fontSize: 24, fontWeight: 600 }}>Lista de turnos</div>
            <Pill text={`${turnosDelDia.length} turnos`} />
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {turnosOrdenados.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTurno(t)}
                style={styles.dayListItem}
              >
                <div style={styles.dayListTime}>{t.hora}</div>
                <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={styles.dayListVehiculo} title={t.vehiculo.modelo}>
                    {t.vehiculo.marca} {t.vehiculo.modelo}
                  </div>
                  <div style={styles.dayListSub}>
                    {t.cliente.nombre}
                    {t.duracion != null ? <> • {t.duracion} min</> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

const styles = {
  emptyState: {
    padding: 36,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  } as const,
  timelineRoot: {
    position: "relative" as const,
  } as const,
  timelineGrid: {
    display: "grid",
    gap: 0,
  } as const,
  timelineRow: {
    display: "flex",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  timelineHourLabel: {
    width: 70,
    flexShrink: 0,
    padding: "14px 10px",
    textAlign: "right" as const,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
    fontSize: 13,
  } as const,
  timelineHourCell: {
    position: "relative" as const,
    minHeight: 60,
    flex: 1,
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
  timelineHalfLine: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    background: COLOR.BORDER.SUBTLE,
    opacity: 0.6,
  } as const,
  timelineOverlay: {
    position: "absolute" as const,
    inset: 0,
    left: 70,
    pointerEvents: "none" as const,
  } as const,
  timelineTurno: {
    position: "absolute" as const,
    pointerEvents: "auto" as const,
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    borderRadius: 10,
    padding: 10,
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
    boxShadow: "0 4px 12px rgba(0, 128, 162, 0.20)",
    cursor: "pointer",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  } as const,
  tlHora: {
    fontWeight: 700,
    fontSize: 12,
  } as const,
  tlVehiculo: {
    fontSize: 12,
    opacity: 0.95,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const,
  tlTitular: {
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const,
  tlDuracion: {
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap" as const,
  } as const,
  timelineTurnoBottom: {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  } as const,
  nowLineHorizontal: {
    position: "absolute" as const,
    left: 70,
    right: 0,
    height: 2,
    background: COLOR.ICON.DANGER,
    zIndex: 3,
    pointerEvents: "none" as const,
  } as const,
  dayListHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  } as const,
  dayListItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left" as const,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 10,
    cursor: "pointer",
  } as const,
  dayListTime: {
    width: 68,
    fontWeight: 700,
    fontSize: 22,
  } as const,
  dayListVehiculo: {
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const,
  dayListSub: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const,
} as const;

