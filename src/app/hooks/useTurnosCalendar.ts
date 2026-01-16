"use client";

import { useMemo, useState } from "react";
import { APP_LOCALE } from "@/lib/format";
import { DIAS_SEMANA, MESES } from "@/app/components/turnos/constants";
import { getWeekDays } from "@/app/components/turnos/utils/calendar";

export enum VistaTurnos {
  Semanal = "semanal",
  Mensual = "mensual",
  Diaria = "diaria",
}

type PeriodoLabelParams = {
  vista: VistaTurnos;
  fechaActual: Date;
  diasSemana: Date[];
};

export function buildPeriodoLabel({ vista, fechaActual, diasSemana }: PeriodoLabelParams) {
  if (vista === VistaTurnos.Mensual) {
    return `${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
  }
  if (vista === VistaTurnos.Diaria) {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(fechaActual);
  }
  const start = diasSemana[0];
  const end = diasSemana[6];
  return `Semana del ${start.getDate()} al ${end.getDate()} de ${MESES[fechaActual.getMonth()]}`;
}

export function shiftFechaByPeriodo(fechaActual: Date, vista: VistaTurnos, direction: -1 | 1) {
  const d = new Date(fechaActual);
  if (vista === VistaTurnos.Mensual) d.setMonth(d.getMonth() + direction);
  else if (vista === VistaTurnos.Diaria) d.setDate(d.getDate() + direction);
  else d.setDate(d.getDate() + 7 * direction);
  return d;
}

export function useTurnosCalendar() {
  const [vista, setVista] = useState<VistaTurnos>(VistaTurnos.Semanal);
  const [fechaActual, setFechaActual] = useState<Date>(new Date());

  const diasSemana = useMemo(() => getWeekDays(fechaActual), [fechaActual]);

  const periodoLabel = useMemo(
    () => buildPeriodoLabel({ vista, fechaActual, diasSemana }),
    [vista, fechaActual, diasSemana]
  );

  const changePeriod = (direction: -1 | 1) => {
    setFechaActual((prev) => shiftFechaByPeriodo(prev, vista, direction));
  };

  const goPrevPeriod = () => changePeriod(-1);
  const goNextPeriod = () => changePeriod(1);

  const goToToday = () => setFechaActual(new Date());

  return {
    vista,
    setVista,
    fechaActual,
    setFechaActual,
    diasSemana,
    periodoLabel,
    goPrevPeriod,
    goNextPeriod,
    goToToday,
    labels: { diasSemana: DIAS_SEMANA, meses: MESES },
  } as const;
}

