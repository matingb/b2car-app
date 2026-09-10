"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import Pill from "@/app/components/turnos/Pill";
import { APP_LOCALE } from "@/lib/format";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { CalendarDays, Car, Clock, MapPin, User, X } from "lucide-react";
import { Turno } from "@/model/types";
import { horaAMinutos } from "@/lib/fechas";
import WhatsAppIcon from "@/app/components/ui/WhatsAppIcon";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { formatTelephoneNumber } from "@/lib/telefono";

type Props = {
  open: boolean;
  turno: Turno | null;
  onClose: () => void;
  onEdit?: (turno: Turno) => void;
  onCancel?: (turno: Turno) => void;
  onShare?: (turno: Turno) => void;
};

export default function TurnoDetailsModal({
  open,
  turno,
  onClose,
  onEdit,
  onCancel,
  onShare,
}: Props) {
  if (!open || !turno) return null;

  const fechaLabel = new Intl.DateTimeFormat(APP_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${turno.fecha}T00:00:00`));

  const finMin = horaAMinutos(turno.hora) + (turno.duracion || 0);
  const finHora = String(Math.floor(finMin / 60)).padStart(2, "0");
  const finMinStr = String(finMin % 60).padStart(2, "0");


  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.header}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{turno.titulo || "Detalle del turno"}</h2>
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Pill text={turno.tipo || "Sin tipo"} />
            {turno.taller?.nombre ? (
              <Pill text={`📍 ${turno.taller.nombre}`} />
            ) : null}
          </div>

          <div css={styles.grid}>
            <Card>
              <div style={{ display: "grid", gap: 10 }}>
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

                <div style={styles.infoRow}>
                  <div style={styles.iconWrap}>
                    <Clock size={18} color={COLOR.ACCENT.PRIMARY} />
                  </div>
                  <div>
                    <div style={styles.infoLabel}>Duración</div>
                    {turno.duracion !== null && turno.duracion > 0 ? (
                      <>
                        <div style={styles.infoValue}>{turno.duracion} minutos</div>
                        <div style={styles.infoSubValue}>
                          Fin estimado: {finHora}:{finMinStr}
                        </div>
                      </>
                    ) : (
                      <div style={styles.infoValue}>Sin definir</div>
                    )}
                  </div>
                </div>

                {turno.taller ? (
                  <div style={styles.infoRow}>
                    <div style={styles.iconWrap}>
                      <MapPin size={18} color={COLOR.ACCENT.PRIMARY} />
                    </div>
                    <div>
                      <div style={styles.infoLabel}>Sucursal</div>
                      <div style={styles.infoValue}>{turno.taller.nombre}</div>
                      {turno.taller.ubicacion ? (
                        <div style={styles.infoSubValue}>{turno.taller.ubicacion}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: 10 }}>
                {turno.cliente ? (
                  <div style={styles.infoRow}>
                    <div style={styles.iconWrap}>
                      <User size={18} color={COLOR.ACCENT.PRIMARY} />
                    </div>
                    <div>
                      <div style={styles.infoLabel}>Titular</div>
                      <div style={styles.infoValue}>{turno.cliente.nombre}</div>
                      {turno.cliente.telefono ? (
                        <div style={styles.infoSubValue}>
                          {formatTelephoneNumber(turno.cliente.codigo_pais, turno.cliente.telefono)}
                        </div>
                      ) : null}
                      {turno.cliente.email ? (
                        <div style={styles.infoSubValue}>{turno.cliente.email}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {turno.vehiculo ? (
                  <div style={styles.infoRow}>
                    <div style={styles.iconWrap}>
                      <Car size={18} color={COLOR.ACCENT.PRIMARY} />
                    </div>
                    <div>
                      <div style={styles.infoLabel}>Vehículo</div>
                      <div style={styles.infoValue}>{formatPatenteConMarcaYModelo(turno.vehiculo)}</div>
                    </div>
                  </div>
                ) : null}

                {!turno.cliente && !turno.vehiculo ? (
                  <div style={{ padding: "8px 0", color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                    Turno sin cliente ni vehículo registrado.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
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
              text="Compartir"
              outline
              hideTextOnMobile={false}
              icon={<WhatsAppIcon size={16} color={turno.cliente?.telefono ? "#25D366" : COLOR.TEXT.TERTIARY} />}
              onClick={() => onShare?.(turno)}
              disabled={!turno.cliente?.telefono}
              title={turno.cliente?.telefono ? "Compartir por WhatsApp" : "El cliente no tiene teléfono registrado"}
              style={{ minWidth: 0 }}
            />
            <Button
              text="Editar"
              outline
              hideTextOnMobile={false}
              onClick={() => onEdit?.(turno)}
              style={{ minWidth: 0 }}
            />
            <Button
              text="Eliminar"
              hideTextOnMobile={false}
              onClick={() => onCancel?.(turno)}
              style={{ minWidth: 0, background: COLOR.ICON.DANGER, borderColor: COLOR.ICON.DANGER }}
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
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "90vh",
    overflowY: "auto" as const,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  grid: css({
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  infoRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    padding: 6,
    borderRadius: 8,
    background: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  infoSubValue: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  footer: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
} as const;
