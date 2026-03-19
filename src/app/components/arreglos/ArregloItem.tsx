"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
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
};

export default function ArregloItem({
  arreglo: initialArreglo,
  onClick,
}: Props) {
  const { talleres } = useTenant();
  const router = useRouter();
  const arreglo = initialArreglo;

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
            <div css={styles.leftSection}>
              <h3 css={styles.mainTitle}>{arreglo.descripcion ? arreglo.descripcion : arreglo.tipo}</h3>
              <div css={styles.metaRow}>
                <ArregloEstadoBadge estado={arreglo.estado} size="sm" />
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

            <div css={styles.rightSection}>
              <div css={styles.priceSection}>
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
              <span css={styles.infoLabel}>Tipo</span>
              <IconLabel
                icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={arreglo.tipo || "N/A"}
              />
            </div>

            <div css={styles.infoColumn}>
              <span css={styles.infoLabel}>Fecha</span>
              <IconLabel
                icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={formatDateLabel(arreglo.fecha)}
              />
            </div>

            <div css={[styles.infoColumn, styles.hideOnMobile]}>
              <span css={styles.infoLabel}>Kilometraje</span>
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
              <span css={styles.infoLabel}>Vehiculo</span>
              <IconLabel
                icon={<Car size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={`${arreglo.vehiculo.marca || ""} ${arreglo.vehiculo.modelo || ""}`.trim() || "-"}
              />
            </div>
            {talleres.length > 1 ? (
              <div
                css={[styles.infoColumn, styles.hideOnMobile]}
                title={arreglo.taller?.ubicacion ?? undefined}
              >
                <span css={styles.infoLabel} data-testid="arreglo-item-taller-label">
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
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      alignItems: "center",
      gap: 8,
    },
  }),
  leftSection: css({
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "contents",
    },
  }),
  metaRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    maxWidth: "100%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      maxWidth: "100%",
      rowGap: 6,
      gridColumn: "1 / 2",
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
      maxWidth: "100%",
      whiteSpace: "normal",
      overflow: "visible",
      textOverflow: "clip",
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
  rightSection: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "auto",
      justifyContent: "flex-end",
      alignSelf: "center",
    },
  }),
  priceSection: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      alignItems: "flex-end",
    },
  }),
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
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
      width: "100%",
    },
  }),
  infoColumn: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gap: 0,
    },
  }),
  hideOnMobile: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  infoLabel: css({
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
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
