"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import CardRightInfo from "@/app/components/ui/CardRightInfo";
import ArregloBadges from "@/app/components/arreglos/ArregloBadges";
import Avatar from "@/app/components/ui/Avatar";
import { Arreglo } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import {
  FileText,
  CarFront,
  User,
  Users,
  Wrench,
} from "lucide-react";

import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { formatArregloTitulo } from "@/lib/arreglos";
import { Permission } from "@/lib/permissions";
import { getEmpleadoColor } from "@/app/providers/EmpleadosProvider";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import ArregloCategoriasList from "@/app/components/arreglos/ArregloCategoriasList";
import { css } from "@emotion/react";

type EmpleadoInfo = {
  id?: string;
  nombre: string;
  apellido?: string;
};

type Props = {
  arreglo: Arreglo;
  onClick?: (arreglo: Arreglo) => void;
  showObservaciones?: boolean;
  mostrarObservaciones?: boolean;
  empleados?: EmpleadoInfo[];
  /** Se invoca al registrar o anular un cobro desde el badge de pago. */
  onPagoUpdated?: (updatedArreglo: Arreglo) => void;
};

function getFullName(emp: EmpleadoInfo | string): string {
  if (typeof emp === "string") return emp;
  return `${emp.nombre || ""} ${emp.apellido || ""}`.trim();
}

export default function ArregloItem({
  arreglo: initialArreglo,
  onClick,
  showObservaciones,
  mostrarObservaciones,
  empleados: empleadosProp,
  onPagoUpdated,
}: Props) {
  const { categorias } = useCategoriasArreglo();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isBadgeOpen, setIsBadgeOpen] = useState(false);

  const arreglo = initialArreglo;

  const shouldShowObservaciones =
    showObservaciones ?? mostrarObservaciones ?? false;

  const vehiculoText = arreglo.vehiculo
    ? formatPatenteConMarcaYModelo(arreglo.vehiculo)
    : "Sin vehículo";

  const resolvedEmpleados = empleadosProp || arreglo.empleados || [];

  return (
    <div
      data-testid="arreglo-item-wrapper"
      style={styles.wrapper(isBadgeOpen, isHovered)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        onClick={() => {
          if (onClick) return onClick(arreglo);
          router.push(`/arreglos/${arreglo.id}`);
        }}
        style={styles.card}
      >
        <div css={styles.cardBody} style={styles.cardBodyStyle}>
          {/* Sección Izquierda: Información Principal */}
          <div css={styles.mainInfoSection} style={styles.mainInfoSectionStyle}>
            <div css={styles.topRow} style={styles.topRowStyle}>
              <h4
                css={styles.mainTitle}
                style={styles.mainTitleStyle}
                title={formatArregloTitulo(arreglo)}
              >
                {formatArregloTitulo(arreglo)}
              </h4>
            </div>

            {/* Fila Metadatos 1: Vehículo, Cliente y Empleados */}
            <div css={styles.mobileMetaRow}>
              <div style={styles.metaItem}>
                <CarFront size={16} color={COLOR.ICON.MUTED} />
                <span css={styles.mobileMetaText}>{vehiculoText}</span>
              </div>
              {resolvedEmpleados.length > 0 ? (
                <div style={styles.metaItem}>
                  <User size={16} color={COLOR.ICON.MUTED} />
                  <span css={styles.mobileMetaText}>
                    {getFullName(resolvedEmpleados[0])}
                    {resolvedEmpleados.length > 1 ? ` +${resolvedEmpleados.length - 1}` : ""}
                  </span>
                </div>
              ) : null}
            </div>

            <div css={styles.desktopMetaRow}>
              <div style={styles.metaItem}>
                <CarFront size={16} color={COLOR.ICON.MUTED} />
                <span style={styles.metaTextBold}>{vehiculoText}</span>
              </div>

              {arreglo.vehiculo?.nombre_cliente && (
                <div style={styles.metaItem}>
                  <User size={16} color={COLOR.ICON.MUTED} />
                  <span style={{ color: COLOR.TEXT.SECONDARY }}>Cliente:</span>
                  <span style={styles.metaTextBold}>
                    {arreglo.vehiculo.nombre_cliente}
                  </span>
                </div>
              )}

              {resolvedEmpleados.length > 0 && (
                <div style={styles.metaItem}>
                  <Users size={16} color={COLOR.ICON.MUTED} />
                  <span style={{ color: COLOR.TEXT.SECONDARY }}>
                    {resolvedEmpleados.length === 1 ? "Técnico:" : "Técnicos:"}
                  </span>
                  <div style={styles.avatarsContainer}>
                    {resolvedEmpleados.map((emp, idx) => {
                      const colorScheme = getEmpleadoColor(emp.id);
                      const name = getFullName(emp);
                      return (
                        <div
                          key={idx}
                          title={name}
                          style={styles.avatarItem(idx, resolvedEmpleados.length - idx)}
                        >
                          <Avatar
                            nombre={name}
                            size={24}
                            bgColor={colorScheme.avatarBg}
                            textColor={colorScheme.avatarText}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Categorías */}
            {arreglo.categorias && arreglo.categorias.length > 0 && (
              <div css={styles.desktopOnlyContent}>
                <div style={styles.metaItem}>
                <Wrench size={16} color={COLOR.ICON.MUTED} />
                <span style={{ color: COLOR.TEXT.SECONDARY }}>Categorías:</span>
                <ArregloCategoriasList
                  categorias={arreglo.categorias.map(id => ({ id, nombre: categorias.find(t => t.id === id)?.nombre || "Desconocido" }))}
                  size="sm"
                  limit={3}
                />
                </div>
              </div>
            )}

            {/* Observaciones unificadas en el cuerpo */}
            {shouldShowObservaciones && arreglo.observaciones && (
              <div css={styles.desktopOnlyContent}>
                <div style={styles.observacionesContainer}>
                  <FileText
                    size={15}
                    color={COLOR.ICON.MUTED}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={styles.observacionesText}>
                    &quot;{arreglo.observaciones}&quot;
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sección Derecha: Fecha, Precio y Taller */}
          <CardRightInfo
            price={formatArs(arreglo.precio_final, {
              maxDecimals: 0,
              minDecimals: 0,
            })}
            pricePermission={Permission.ArreglosPreciosView}
            date={formatDateLabel(arreglo.fecha)}
            taller={
              arreglo.taller
                ? {
                    nombre: arreglo.taller.nombre,
                    ubicacion: arreglo.taller.ubicacion,
                  }
                : null
            }
            hideTallerOnMobile={true}
          />
        </div>

        {/* Footer del card con estado a la izquierda y badges de facturación/pago a la derecha */}
        <div css={styles.desktopOnlyContent}>
          <ArregloBadges
            arreglo={arreglo}
            variant="footer"
            size="sm"
            onOpenChange={setIsBadgeOpen}
            onPagoUpdated={onPagoUpdated}
            onFacturableChanged={(val) => {
              arreglo.es_facturable = val;
            }}
          />
        </div>
      </Card>
    </div>
  );
}

const styles = {
  wrapper: (isBadgeOpen: boolean, isHovered: boolean) => ({
    position: "relative" as const,
    zIndex: isBadgeOpen ? 100 : isHovered ? 1 : 0,
  }),
  card: {
    cursor: "pointer",
    boxSizing: "border-box" as const,
    padding: 0,
    overflow: "visible",
    position: "relative" as const,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  cardBodyStyle: {
    minWidth: 0,
    width: "100%",
  },
  mainInfoSectionStyle: {
    minWidth: 0,
    overflow: "hidden",
  },
  topRowStyle: {
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  },
  mainTitleStyle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  cardBody: css({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
    },
  }),
  mainInfoSection: css({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    padding: "17px 20px 15px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 6,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      borderBottom: "none",
      borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
      padding: "16px 20px",
    },
  }),
  topRow: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  }),
  mainTitle: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
    paddingRight: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    [`@media (max-width: ${BREAKPOINTS.md - 1}px)`]: {
      fontSize: 14,
    },
  }),
  badgesGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    rowGap: 8,
    columnGap: 20,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  desktopMetaRow: css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      rowGap: 8,
      columnGap: 20,
      fontSize: 13,
      color: COLOR.TEXT.SECONDARY,
    },
  }),
  mobileMetaRow: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 18,
    rowGap: 6,
    color: COLOR.TEXT.SECONDARY,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  mobileMetaText: css({
    maxWidth: "min(48vw, 185px)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 500,
  }),
  desktopOnlyContent: css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      display: "block",
    },
  }),
  metaItem: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 6,
    fontSize: 13,
  },
  metaTextBold: {
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  avatarsContainer: {
    display: "flex",
    alignItems: "center",
  },
  avatarItem: (idx: number, zIndex: number) => ({
    marginLeft: idx === 0 ? 0 : -6,
    zIndex,
    borderRadius: "50%",
    border: "2px solid #ffffff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    display: "flex",
  }),
  observacionesContainer: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
    paddingTop: 4,
  },
  observacionesText: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.4,
  },
} as const;
