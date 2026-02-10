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
  onSelectDiaMensual,
  onSelectDiaSemanal,
}: {
  vista: VistaTurnos;
  fechaActual: Date;
  onSelectTurno: (t: Turno) => void;
  onSelectDiaMensual?: (d: Date, hora?: string) => void;
  onSelectDiaSemanal?: (d: Date, hora?: string) => void;
}) {
  switch (vista) {
    case VistaTurnos.Mensual:
      return (
        <TurnosMonthlyView
          fechaActual={fechaActual}
          onSelectTurno={onSelectTurno}
          onSelectDia={onSelectDiaMensual}
        />
      );
    case VistaTurnos.Semanal:
      return (
        <TurnosWeeklyGridHView
          fechaActual={fechaActual}
          onSelectTurno={onSelectTurno}
          onSelectDia={onSelectDiaSemanal}
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
    setFechaActual,
  } = useTurnosCalendar();
  const { confirm } = useModalMessage();
  const { success, error: toastError } = useToast();

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

  const goToDailyForDate = (d: Date) => {
    setFechaActual(d);
    setVista(VistaTurnos.Diaria);
  };

  const buildTurnoWhatsappMessage = (turno: Turno) => {
    const lines: string[] = [];

    lines.push(`*Detalle del turno - ${localStorage.getItem("tenant_name")}*`);
    if (turno.cliente?.nombre) {
      lines.push(`👤 ${turno.cliente.nombre}`);
    }
    if (turno.vehiculo) {
      const vehiculoLabel = `${turno.vehiculo.marca} ${turno.vehiculo.modelo} - ${turno.vehiculo.patente}`.trim();
      lines.push(`🚗 ${vehiculoLabel}`);
    }
    lines.push(""
    );
    lines.push(`📅 Fecha: ${turno.fecha}`);
    lines.push(`⏰ Hora: ${turno.hora} hs`);
    if (turno.duracion != null && turno.duracion > 0) {
      lines.push(`⏱️ Duración: ${turno.duracion} minutos`);
    }
    if (turno.descripcion) {
      lines.push("");
      lines.push(`📝 ${turno.descripcion}`);
    }
    if (turno.observaciones) {
      lines.push("");
      lines.push(`🗒️ Observaciones: ${turno.observaciones}`);
    }

    return lines.join("\n");
  };

  const buildWhatsappLink = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);
    return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}&type=phone_number&app_absent=0`;
  };

  const handleShareTurno = (turno: Turno) => {
    const telefono = turno.cliente?.telefono;
    if (!telefono) {
      toastError("El cliente no tiene teléfono cargado");
      return;
    }

    const cleanPhone = telefono.replace(/\D/g, "");
    if (!cleanPhone) {
      toastError("El teléfono del cliente no es válido");
      return;
    }

    const mensaje = buildTurnoWhatsappMessage(turno);
    if (!mensaje) {
      toastError("No se pudo generar el mensaje");
      return;
    }

    const url = buildWhatsappLink(cleanPhone, mensaje);
    window.open(url, "_blank");
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
            onSelectDiaMensual={goToDailyForDate}
            onSelectDiaSemanal={openCreateForDate}
          />
        </div>
      )}

      <TurnoDetailsModal
        open={modalOpen}
        turno={turnoSeleccionado}
        onClose={() => setModalOpen(false)}
        onEdit={(turno) => {
          setModalOpen(false);
          setTurnoToEdit(turno);
          setModalCreateOpen(true);
        }}
        onShare={handleShareTurno}
        onCancel={async (turno) => {
          setModalOpen(false);
          const confirmed = await confirm({
            message: "¿Estás seguro de que deseas eliminar este arreglo?",
            title: "Eliminar arreglo",
            acceptLabel: "Eliminar",
            cancelLabel: "Cancelar",
          });
          if (confirmed) handleDeleteTurno(turno);
        }}
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
