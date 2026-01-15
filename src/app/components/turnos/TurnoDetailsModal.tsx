"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import Pill from "@/app/components/turnos/Pill";
import { APP_LOCALE } from "@/lib/format";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { CalendarDays, Clock, User, Wrench, X } from "lucide-react";
import type { Turno } from "@/app/providers/TurnosProvider";
import { horaAMinutos } from "@/app/components/turnos/utils/calendar";

type Props = {
  open: boolean;
  turno: Turno | null;
  onClose: () => void;
  onEdit?: (turno: Turno) => void;
  onPrint?: (turno: Turno) => void;
  onCancel?: (turno: Turno) => void;
};

export default function TurnoDetailsModal({
  open,
  turno,
  onClose,
  onEdit,
  onPrint,
  onCancel,
}: Props) {
  if (!open || !turno) return null;

  const fechaLabel = new Intl.DateTimeFormat(APP_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${turno.fecha}T00:00:00`));

  const finMin = horaAMinutos(turno.hora) + turno.duracion;
  const finHora = String(Math.floor(finMin / 60)).padStart(2, "0");
  const finMinStr = String(finMin % 60).padStart(2, "0");

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.header}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Detalle del turno</h2>
              <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                Información completa del turno
              </div>
            </div>
            <IconButton
              icon={<X />}
              onClick={onClose}
              title="Cerrar"
              ariaLabel="Cerrar"
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill text={turno.tipo} />
          </div>

          <div css={styles.grid}>
            <Card>
              <div style={styles.infoRow}>
                <div style={styles.iconWrap}>
                  <CalendarDays size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>
                <div>
                  <div style={styles.infoLabel}>Fecha y hora</div>
                  <div style={styles.infoValue}>{fechaLabel}</div>
                  <div style={styles.infoSubValue}>{turno.hora} hs</div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={styles.infoRow}>
                <div style={styles.iconWrap}>
                  <Clock size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>
                <div>
                  <div style={styles.infoLabel}>Duración</div>
                  <div style={styles.infoValue}>{turno.duracion} minutos</div>
                  <div style={styles.infoSubValue}>
                    Fin estimado: {finHora}:{finMinStr}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={styles.infoRow}>
                <div style={styles.iconWrap}>
                  <User size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>
                <div>
                  <div style={styles.infoLabel}>Titular</div>
                  <div style={styles.infoValue}>{turno.titular}</div>
                  {turno.telefono ? (
                    <div style={styles.infoSubValue}>{turno.telefono}</div>
                  ) : null}
                  {turno.email ? (
                    <div style={styles.infoSubValue}>{turno.email}</div>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card>
              <div style={styles.infoRow}>
                <div style={styles.iconWrap}>
                  <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
                </div>
                <div>
                  <div style={styles.infoLabel}>Mecánico asignado</div>
                  <div style={styles.infoValue}>{turno.mecanico || "-"}</div>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Vehículo</div>
              <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                {turno.vehiculo}
              </div>
            </Card>

            {turno.descripcion ? (
              <Card>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Descripción del trabajo
                </div>
                <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                  {turno.descripcion}
                </div>
              </Card>
            ) : null}

            {turno.observaciones ? (
              <Card>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Observaciones
                </div>
                <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                  {turno.observaciones}
                </div>
              </Card>
            ) : null}
          </div>

          <div style={styles.footer}>
            <Button
              text="Editar"
              outline
              hideText={false}
              onClick={() => onEdit?.(turno)}
              style={{ minWidth: 0 }}
            />
            <Button
              text="Imprimir"
              outline
              hideText={false}
              onClick={() => onPrint?.(turno)}
              style={{ minWidth: 0 }}
            />
            <Button
              text="Cancelar"
              hideText={false}
              onClick={() => onCancel?.(turno)}
              style={{ minWidth: 0, background: COLOR.ICON.DANGER }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
  },
  modal: {
    width: "min(860px, 92vw)",
    maxHeight: "calc(100dvh - 24px)",
    WebkitOverflowScrolling: "touch" as const,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap" as const,
  },
  grid: css({
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    marginTop: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    },
  }),
  infoRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 900,
    marginTop: 2,
  },
  infoSubValue: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginTop: 2,
  },
} as const;

