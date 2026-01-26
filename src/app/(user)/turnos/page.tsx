"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useTurnos } from "@/app/providers/TurnosProvider";
import { Turno } from "@/model/types";
import { COLOR } from "@/theme/theme";
import TurnosToolbar from "@/app/components/turnos/TurnosToolbar";
import TurnoDetailsModal from "@/app/components/turnos/TurnoDetailsModal";
import TurnoCreateModal from "@/app/components/turnos/TurnoCreateModal";
import TurnosWeeklyGridHView from "@/app/components/turnos/semanal/TurnosWeeklyGridHView";
import TurnosMonthlyView from "@/app/components/turnos/mensual/TurnosMonthlyView";
import TurnosDailyView from "@/app/components/turnos/diaria/TurnosDailyView";
import { useTurnosCalendar } from "@/app/hooks/useTurnosCalendar";
import { VistaTurnos } from "@/app/hooks/useTurnosCalendar";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";

function TurnosVista({
  vista,
  fechaActual,
  onSelectTurno,
  onSelectDia,
}: {
  vista: VistaTurnos;
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDia?: (d: Date, hora?: string) => void;
}) {
  switch (vista) {
    case VistaTurnos.Mensual:
      return (
        <TurnosMonthlyView
          fechaActual={fechaActual}
          onSelectTurno={onSelectTurno}
          onSelectDia={onSelectDia}
        />
      );
    case VistaTurnos.Semanal:
      return (
        <TurnosWeeklyGridHView
          fechaActual={fechaActual}
          onSelectTurno={onSelectTurno}
          onSelectDia={onSelectDia}
        />
      );
    case VistaTurnos.Diaria:
      return <TurnosDailyView fechaActual={fechaActual} onSelectTurno={onSelectTurno} />;
    default:
      return null;
  }
}

export default function TurnosPage() {
  const { loading, error, remove } = useTurnos();

  const {
    vista,
    setVista,
    fechaActual,
    periodoLabel,
    goPrevPeriod,
    goNextPeriod,
    goToToday,
  } = useTurnosCalendar();
  const { confirm } = useModalMessage();
  const { success } = useToast();

  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [turnoToEdit, setTurnoToEdit] = useState<Turno | null>(null);
  const [defaultFechaCreate, setDefaultFechaCreate] = useState<Date | undefined>(undefined);
  const [defaultHoraCreate, setDefaultHoraCreate] = useState<string | undefined>(undefined);

  const openDetails = (t: Turno) => {
    setTurnoSeleccionado(t);
    setModalOpen(true);
  };

  const openCreateForDate = (d: Date, hora?: string) => {
    setTurnoToEdit(null);
    setDefaultFechaCreate(d);
    setDefaultHoraCreate(hora);
    setModalCreateOpen(true);
  };


  const handleDeleteTurno = async (turno: Turno) => {
    await remove(turno.id);
    setModalOpen(false);
    success("Turno eliminado correctamente.");
  }

  return (
    <div style={{ minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
      <ScreenHeader title="Turnos" breadcrumbs={["Agenda"]} />

      <TurnosToolbar
        vista={vista}
        onChangeVista={setVista}
        periodoLabel={periodoLabel}
        onPrev={goPrevPeriod}
        onNext={goNextPeriod}
        onToday={goToToday}
        onNewTurno={() => openCreateForDate(fechaActual)}
      />

      {loading ? (
        <div style={{ marginTop: 12, color: COLOR.TEXT.SECONDARY }}>
          Cargando...
        </div>
      ) : error ? (
        <div style={{ marginTop: 12, color: COLOR.ICON.DANGER }}>{error}</div>
      ) : (
        <div style={{ marginTop: 12, minWidth: 0, maxWidth: "100%" }}>
          <TurnosVista
            vista={vista}
            fechaActual={fechaActual}
            onSelectTurno={openDetails}
            onSelectDia={openCreateForDate}
          />
        </div>
      )}

      <TurnoDetailsModal
        open={modalOpen}
        turno={turnoSeleccionado}
        onClose={() => setModalOpen(false)}
        onEdit={async (turno) => {
          setModalOpen(false);
          const confirmed = await confirm({
            message: "¿Estás seguro de que deseas eliminar este arreglo?",
            title: "Eliminar arreglo",
            acceptLabel: "Eliminar",
            cancelLabel: "Cancelar",
          });
          if (confirmed) handleDeleteTurno(turno);
        }}
        onCancel={(turno) => handleDeleteTurno(turno)}
      />

      <TurnoCreateModal
        open={modalCreateOpen}
        defaultFecha={defaultFechaCreate ?? fechaActual}
        defaultHora={defaultHoraCreate}
        turnoToEdit={turnoToEdit}
        onClose={() => {
          setModalCreateOpen(false);
          setTurnoToEdit(null);
          setDefaultFechaCreate(undefined);
          setDefaultHoraCreate(undefined);
        }}
      />
    </div>
  );
}
