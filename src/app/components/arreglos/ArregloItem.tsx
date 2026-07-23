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
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isBadgeOpen, setIsBadgeOpen] = useState(false);

  const arreglo = initialArreglo;

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
        <div style={styles.cardBody}>
          {/* Sección Izquierda: Información Principal */}
          <div style={styles.mainInfoSection}>
            <div style={styles.topRow}>
              <h4 style={styles.mainTitle}>
                {arreglo.descripcion || "Arreglo sin descripción"}
              </h4>
              <div style={styles.badgesGroup}>
                <ArregloPagoBadge estaPago={arreglo.esta_pago} arregloId={arreglo.id} size="sm" />
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

              {rawEmpleados.length > 0 && (
                <div style={styles.metaItem}>
                  <Users size={16} color={COLOR.ICON.MUTED} />
                  <span style={{ color: COLOR.TEXT.SECONDARY }}>
                    {rawEmpleados.length === 1 ? "Técnico:" : "Técnicos:"}
                  </span>
                  <div style={styles.avatarsContainer}>
                    {rawEmpleados.map((emp, idx) => {
                      const colorScheme =
                        AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      const name = getFullName(emp);
                      return (
                        <div
                          key={idx}
                          title={name}
                          style={styles.avatarItem(idx, rawEmpleados.length - idx)}
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

            {/* Categorías */}
            {arreglo.categorias && arreglo.categorias.length > 0 && (
              <div style={styles.metaItem}>
                <Wrench size={16} color={COLOR.ICON.MUTED} />
                <span style={{ color: COLOR.TEXT.SECONDARY }}>Categorías:</span>
                <ArregloCategoriasList
                  categorias={arreglo.categorias.map(id => ({ id, nombre: categorias.find(t => t.id === id)?.nombre || "Desconocido" }))}
                  size="sm"
                  limit={3}
                />
              </div>
            )}
          </div>

          {/* Sección Derecha: Fecha, Precio y Taller */}
          <div style={styles.rightInfoSection(hasObservaciones)}>
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
                style={styles.tallerContainer}
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
              style={{ flexShrink: 0, marginTop: 2 }}
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
  cardBody: {
    display: "flex",
    flexWrap: "wrap" as const,
    width: "100%",
  },
  mainInfoSection: {
    flex: "1 1 350px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    gap: 10,
  },
  topRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
    paddingRight: 8,
  },
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
  rightInfoSection: (hasObservaciones: boolean) => ({
    flex: "1 1 190px",
    padding: "16px 20px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    flexWrap: "wrap" as const,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
  tallerContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.TERTIARY,
  },
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
  observacionesText: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.4,
  },
} as const;
