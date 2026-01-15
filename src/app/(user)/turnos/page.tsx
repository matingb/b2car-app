"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTurnos } from "@/app/providers/TurnosProvider";
import type { Turno } from "@/app/providers/TurnosProvider";
import { COLOR } from "@/theme/theme";
import TurnosToolbar from "@/app/components/turnos/TurnosToolbar";
import TurnoDetailsModal from "@/app/components/turnos/TurnoDetailsModal";
import TurnosWeeklyGridHView from "@/app/components/turnos/semanal/TurnosWeeklyGridHView";
import TurnosMonthlyView from "@/app/components/turnos/mensual/TurnosMonthlyView";
import TurnosDailyView from "@/app/components/turnos/diaria/TurnosDailyView";
import { useTurnosCalendar } from "@/app/hooks/useTurnosCalendar";

export default function TurnosPage() {
  const { loading, error } = useTurnos();

  const {
    vista,
    setVista,
    fechaActual,
    periodoLabel,
    goPrev,
    goNext,
    goToday,
  } = useTurnosCalendar(new Date(2025, 0, 15));

  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openDetails = (t: Turno) => {
    setTurnoSeleccionado(t);
    setModalOpen(true);
  };

  return (
    <div style={{ minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
      <ScreenHeader title="Turnos" breadcrumbs={["Agenda"]} />

      <TurnosToolbar
        vista={vista}
        onChangeVista={setVista}
        periodoLabel={periodoLabel}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onNewTurno={() => {}}
      />

      {loading ? (
        <div style={{ marginTop: 12, color: COLOR.TEXT.SECONDARY }}>
          Cargando...
        </div>
      ) : error ? (
        <div style={{ marginTop: 12, color: COLOR.ICON.DANGER }}>{error}</div>
      ) : (
        <div style={{ marginTop: 12, minWidth: 0, maxWidth: "100%" }}>
          {vista === "semanal" ? (
            <TurnosWeeklyGridHView
              fechaActual={fechaActual}
              onSelectTurno={openDetails}
            />
          ) : null}
          {vista === "mensual" ? (
            <TurnosMonthlyView
              fechaActual={fechaActual}
              onSelectTurno={openDetails}
            />
          ) : null}
          {vista === "diaria" ? (
            <TurnosDailyView fechaActual={fechaActual} onSelectTurno={openDetails} />
          ) : null}
        </div>
      )}

      <TurnoDetailsModal open={modalOpen} turno={turnoSeleccionado} onClose={() => setModalOpen(false)} />
    </div>
  );
}
