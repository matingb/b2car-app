"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
import ArregloPagoBadge from "@/app/components/arreglos/ArregloPagoBadge";
import Avatar from "@/app/components/ui/Avatar";
import { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import {
  FileText,
  CarFront,
  Building2,
  User,
  Calendar,
  Users,
  Wrench,
} from "lucide-react";

import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { useTenant } from "@/app/providers/TenantProvider";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { useBreakpoint } from "@/app/providers/BreakpointProvider";
import ArregloCategoriasList from "@/app/components/arreglos/ArregloCategoriasList";

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
};

const AVATAR_COLORS = [
  { bg: "#c7d2fe", text: "#312e81" }, // indigo
  { bg: "#99f6e4", text: "#134e4a" }, // teal
  { bg: "#fecdd3", text: "#881337" }, // rose
  { bg: "#fde68a", text: "#78350f" }, // amber
];



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
}: Props) {
  const { talleres } = useTenant();
  const { categorias } = useCategoriasArreglo();
  const { empleados } = useEmpleados();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isBadgeOpen, setIsBadgeOpen] = useState(false);
  const { isMd, isLg, isXl } = useBreakpoint();

  const arreglo = initialArreglo;

  const categoriasLimit = isLg ? 2 : 3;

  const shouldShowObservaciones =
    showObservaciones ?? mostrarObservaciones ?? false;
  const hasObservaciones = Boolean(shouldShowObservaciones && arreglo.observaciones);

  const vehiculoText = arreglo.vehiculo
    ? formatPatenteConMarcaYModelo(arreglo.vehiculo)
    : "Sin vehículo";

  const rawEmpleados =
    empleadosProp ||
    (arreglo as unknown as { empleados?: EmpleadoInfo[] }).empleados ||
    (arreglo as unknown as { tecnicos?: EmpleadoInfo[] }).tecnicos ||
    [];

  const resolvedEmpleados = rawEmpleados.map(emp => {
    if (typeof emp === "string") {
      const found = empleados.find(e => e.id === emp);
      return found ? found : { id: emp, nombre: emp };
    }
    return emp;
  });

  return (
    <div 
      style={styles.wrapper(isBadgeOpen || isHovered)}
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
        <div style={styles.cardBody(isMd)}>
          {/* Sección Izquierda: Información Principal */}
          <div style={styles.mainInfoSection(isMd)}>
            <div style={styles.topRow(isXl)}>
              <h4 style={styles.mainTitle}>
                {arreglo.descripcion || "Arreglo sin descripción"}
              </h4>
              <div style={styles.badgesGroup(isMd)}>
                <ArregloPagoBadge estaPago={arreglo.esta_pago} arregloId={arreglo.id} size="sm" hideTextOnMobile />
                <ArregloEstadoBadge 
                  estado={arreglo.estado} 
                  size="sm" 
                  arregloId={arreglo.id}
                  onOpenChange={setIsBadgeOpen}
                />
              </div>
            </div>

            {/* Fila Metadatos 1: Vehículo, Cliente y Empleados */}
            <div style={styles.metaRow}>
              <div style={styles.metaItem}>
                <CarFront size={16} color={COLOR.ICON.MUTED} />
                <span style={styles.hideOnMobileInline(isMd)}>{vehiculoText}</span>
                <span style={styles.showOnMobileInline(isMd)}>{arreglo.vehiculo?.patente || "Sin vehículo"}</span>
              </div>

              {arreglo.vehiculo?.nombre_cliente && (
                <div style={styles.metaItem}>
                  <User size={16} color={COLOR.ICON.MUTED} />
                  <span style={styles.hideOnMobileInlineStyleSecondary(isMd)}>Cliente:</span>
                  <span style={styles.metaTextBold}>
                    {arreglo.vehiculo.nombre_cliente}
                  </span>
                </div>
              )}

              {resolvedEmpleados.length > 0 && (
                <div style={styles.hideOnMobileFlex(isMd)}>
                  <Users size={16} color={COLOR.ICON.MUTED} />
                  <span style={styles.textSecondary}>
                    {resolvedEmpleados.length === 1 ? "Técnico:" : "Técnicos:"}
                  </span>
                  <div style={styles.avatarsContainer}>
                    {resolvedEmpleados.map((emp, idx) => {
                      const colorScheme =
                        AVATAR_COLORS[idx % AVATAR_COLORS.length];
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
                            bgColor={colorScheme.bg}
                            textColor={colorScheme.text}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {arreglo.categorias && arreglo.categorias.length > 0 && (
              <div style={styles.hideOnMobileFlexCategorias(isMd)}>
                <Wrench size={16} color={COLOR.ICON.MUTED} />
                <span style={styles.textSecondary}>Categorías:</span>
                <ArregloCategoriasList
                  categorias={arreglo.categorias.map(id => ({ id, nombre: categorias.find(t => t.id === id)?.nombre || "Desconocido" }))}
                  size="sm"
                  limit={categoriasLimit}
                />
              </div>
            )}
          </div>

          {/* Sección Derecha: Fecha, Precio y Taller (Centrado) */}
          <div style={styles.rightInfoSection(hasObservaciones, isMd)}>
            <div style={styles.dateContainer}>
              <Calendar size={15} color={COLOR.ICON.MUTED} />
              <span>{formatDateLabel(arreglo.fecha)}</span>
            </div>

            <div style={styles.priceValue}>
              {formatArs(arreglo.precio_final, {
                maxDecimals: 0,
                minDecimals: 0,
              })}
            </div>

            {talleres.length > 1 && arreglo.taller ? (
              <div
                data-testid="arreglo-item-taller-label"
                style={styles.tallerContainer(isMd)}
                title={arreglo.taller.ubicacion ?? undefined}
              >
                <Building2 size={14} color={COLOR.ICON.MUTED} />
                <span>{arreglo.taller.nombre?.trim() || "Sin taller"}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bloque Inferior de Observaciones */}
        {shouldShowObservaciones && arreglo.observaciones && (
          <div style={styles.observacionesContainer}>
            <FileText
              size={16}
              color={COLOR.ICON.MUTED}
              style={styles.observacionesIcon}
            />
            <span style={styles.observacionesText}>
              &quot;{arreglo.observaciones}&quot;
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

const styles = {
  wrapper: (isHoveredOrBadgeOpen: boolean) => ({
    position: "relative" as const,
    zIndex: isHoveredOrBadgeOpen ? 50 : 1,
  }),
  card: {
    cursor: "pointer",
    boxSizing: "border-box" as const,
    padding: 0,
    overflow: "visible",
    position: "relative" as const,
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  cardBody: (isMd: boolean) => ({
    display: "flex",
    flexDirection: isMd ? "row" as const : "column" as const,
    width: "100%",
  }),
  mainInfoSection: (isMd: boolean) => ({
    flex: 1,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    gap: 6,
    borderBottom: isMd ? "none" : `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRight: isMd ? `1px solid ${COLOR.BORDER.SUBTLE}` : "none",
  }),
  topRow: (isXl: boolean) => ({
    display: "flex",
    flexDirection: isXl ? "row" as const : "column" as const,
    gap: 6,
    flexWrap: isXl ? "nowrap" as const : undefined,
    alignItems: isXl ? "flex-start" : undefined,
    justifyContent: isXl ? "space-between" : undefined,
  }),
  mainTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
    paddingRight: 8,
  },
  badgesGroup: (isMd: boolean) => ({ // Using isMd as approximation for sm in original css (original had sm)
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    flexWrap: isMd ? "nowrap" as const : "wrap" as const, // original was sm for nowrap
  }),
  metaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    rowGap: 6,
    columnGap: 20,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  metaTextBold: {
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  textPrimary: {
    color: COLOR.TEXT.PRIMARY,
  },
  textSecondary: {
    color: COLOR.TEXT.SECONDARY,
  },
  textTertiary: {
    color: COLOR.TEXT.TERTIARY,
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
  rightInfoSection: (hasObservaciones: boolean, isMd: boolean) => ({
    padding: "16px 20px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: isMd ? 160 : undefined,
    textAlign: isMd ? "center" as const : undefined,
    borderTopRightRadius: isMd ? 12 : undefined,
    borderBottomLeftRadius: hasObservaciones ? 0 : (isMd ? 0 : 12),
    borderBottomRightRadius: hasObservaciones ? 0 : 12,
  }),
  dateContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 800,
    color: COLOR.ACCENT.PRIMARY,
    letterSpacing: "-0.5px",
  },
  tallerContainer: (isMd: boolean) => ({
    display: isMd ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.TERTIARY,
  }),
  observacionesContainer: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "12px 16px 12px 20px",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  observacionesIcon: {
    flexShrink: 0,
    marginTop: 2,
  },
  observacionesText: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.4,
  },
  hideOnMobileInline: (isMd: boolean) => ({
    display: isMd ? "inline" : "none",
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  showOnMobileInline: (isMd: boolean) => ({
    display: isMd ? "none" : "inline",
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  hideOnMobileInlineStyleSecondary: (isMd: boolean) => ({
    display: isMd ? "inline" : "none",
    color: COLOR.TEXT.SECONDARY,
  }),
  hideOnMobileFlex: (isMd: boolean) => ({
    display: isMd ? "flex" : "none",
    alignItems: "center",
    gap: 6,
  }),
  hideOnMobileFlexCategorias: (isMd: boolean) => ({
    display: isMd ? "flex" : "none",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
  }),
} as const;

