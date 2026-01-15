"use client";

import { useMemo, useState } from "react";
import { APP_LOCALE } from "@/lib/format";
import { DIAS_SEMANA, MESES } from "@/app/components/turnos/constants";
import { getWeekDays } from "@/app/components/turnos/utils/calendar";

export type VistaTurnos = "semanal" | "mensual" | "diaria";

export function useTurnosCalendar(initialDate: Date = new Date()) {
  const [vista, setVista] = useState<VistaTurnos>("semanal");
  const [fechaActual, setFechaActual] = useState<Date>(initialDate);

  const diasSemana = useMemo(() => getWeekDays(fechaActual), [fechaActual]);

  const periodoLabel = useMemo(() => {
    if (vista === "mensual") {
      return `${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    }
    if (vista === "diaria") {
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
  }, [vista, fechaActual, diasSemana]);

  const goPrev = () => {
    const d = new Date(fechaActual);
    if (vista === "mensual") d.setMonth(d.getMonth() - 1);
    else if (vista === "diaria") d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() - 7);
    setFechaActual(d);
  };

  const goNext = () => {
    const d = new Date(fechaActual);
    if (vista === "mensual") d.setMonth(d.getMonth() + 1);
    else if (vista === "diaria") d.setDate(d.getDate() + 1);
    else d.setDate(d.getDate() + 7);
    setFechaActual(d);
  };

  const goToday = () => setFechaActual(new Date());

  return {
    vista,
    setVista,
    fechaActual,
    setFechaActual,
    diasSemana,
    periodoLabel,
    goPrev,
    goNext,
    goToday,
    labels: { diasSemana: DIAS_SEMANA, meses: MESES },
  } as const;
}

