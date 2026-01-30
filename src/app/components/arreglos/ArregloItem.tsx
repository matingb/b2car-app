"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import { Arreglo } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import {
  Calendar,
  Wrench,
  Gauge,
  FileText,
  CheckCircle2,
  XCircle,
  Car,
  Building2,
} from "lucide-react";
import { css } from "@emotion/react";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { useTenant } from "@/app/providers/TenantProvider";

type Props = {
  arreglo: Arreglo;
  onClick?: (arreglo: Arreglo) => void;
  onUpdated?: () => Promise<void> | void;
};

export default function ArregloItem({
  arreglo: initialArreglo,
  onClick,
  onUpdated,
}: Props) {
  const { talleres } = useTenant();
  const router = useRouter();
  const [openEditModal, setOpenEditModal] = useState(false);
  const [arreglo, setArreglo] = useState<Arreglo>(initialArreglo);

  useEffect(() => {
    setArreglo(initialArreglo);
  }, [initialArreglo]);

  return (
    <div>
      <Card
        onClick={() => {
          if (onClick) return onClick(arreglo);
          router.push(`/arreglos/${arreglo.id}`);
        }}
        style={{ cursor: "pointer", boxSizing: "border-box" }}
      >
        <div style={styles.container}>
          {/* Header superior con badges y precio */}
          <div css={styles.topHeader}>
            <div style={styles.leftSection}>
              <div css={styles.titleRow}>
                <h3 css={styles.mainTitle}>{arreglo.descripcion}</h3>
                <div style={styles.statusBadgeInline}>
                  {arreglo.esta_pago ? (
                    <>
                      <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />
                      <span css={styles.statusText}>Pagado</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={18} color={COLOR.ICON.DANGER} />
                      <span css={styles.statusText}>Pendiente</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.rightSection}>
              <div style={styles.priceSection}>
                <span css={styles.priceValue}>
                  {formatArs(arreglo.precio_final, {
                    maxDecimals: 0,
                    minDecimals: 0,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Divisor */}
          <div style={styles.divider} />

          {/* Grid de informaciИn */}
          <div css={styles.infoGrid}>
            <div css={[styles.infoColumn, styles.hideOnMobile]}>
              <span style={styles.infoLabel}>Tipo</span>
              <IconLabel
                icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={arreglo.tipo || "N/A"}
              />
            </div>

            <div css={styles.infoColumn}>
              <span style={styles.infoLabel}>Fecha</span>
              <IconLabel
                icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={formatDateLabel(arreglo.fecha)}
              />
            </div>

            <div css={[styles.infoColumn, styles.hideOnMobile]}>
              <span style={styles.infoLabel}>Kilometraje</span>
              <IconLabel
                icon={<Gauge size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={
                  arreglo.kilometraje_leido
                    ? `${arreglo.kilometraje_leido.toLocaleString()} km`
                    : "N/A"
                }
              />
            </div>

            <div css={styles.infoColumn}>
              <span style={styles.infoLabel}>Vehiculo</span>
              <IconLabel
                icon={<Car size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={arreglo.vehiculo.patente || "-"}
              />
            </div>
            {talleres.length > 1 ? (
              <div
                css={[styles.infoColumn, styles.hideOnMobile]}
                title={arreglo.taller?.ubicacion ?? undefined}
              >
                <span style={styles.infoLabel} data-testid="arreglo-item-taller-label">
                  Taller
                </span>
                <IconLabel
                  icon={<Building2 size={18} color={COLOR.ACCENT.PRIMARY} />}
                  label={arreglo.taller?.nombre?.trim() || "Sin taller"}
                />
              </div>
            ) : null}
          </div>

          {/* Observaciones */}
          {arreglo.observaciones && (
            <div css={styles.hideOnMobile}>
              <div style={styles.divider} />
              <div style={styles.observaciones}>
                <IconLabel
                  icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />}
                  label={`Observaciones: ${arreglo.observaciones}`}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <ArregloModal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        onSubmitSuccess={() => onUpdated?.()}
        vehiculoId={arreglo.vehiculo.id}
        initial={{
          id: arreglo.id,
          tipo: arreglo.tipo,
          fecha: arreglo.fecha,
          kilometraje_leido: arreglo.kilometraje_leido,
          precio_final: arreglo.precio_final,
          observaciones: arreglo.observaciones,
          descripcion: arreglo.descripcion,
          esta_pago: arreglo.esta_pago,
          extra_data: arreglo.extra_data,
        }}
      />
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  topHeader: css({
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 4,
    },
  }),
  leftSection: {
    overflow: "hidden",
  },
  titleRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    maxWidth: "85%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      maxWidth: "100%",
    },
  }),
  mainTitle: css({
    fontSize: 20,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 16,
      maxWidth: `200px`,
    },
  }),
  statusBadgeInline: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontSize: 14,
  },
  statusText: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  priceSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 400,
  },
  priceValue: css({
    fontSize: 24,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 20,
    },
  }),
  divider: {
    height: 1,
    backgroundColor: COLOR.BORDER.SUBTLE,
    margin: "2px 0",
  },
  subtitle: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  infoGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "2fr 1fr",
      gap: 12,
      width: "10%",
    },
  }),
  infoColumn: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
  }),
  hideOnMobile: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  infoLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  observaciones: {
    marginTop: 8,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  editButton: {
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.TEXT.SECONDARY,
  },
} as const;
