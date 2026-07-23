
"use client";

import React, { useMemo } from "react";

import { useRouter } from "next/navigation";
import {
  Calendar,
  Wrench,
  Pencil,
  Trash,
  Gauge,
  FileText,
  CarFront,
  Users,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import WhatsAppIcon from "@/app/components/ui/WhatsAppIcon";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
import ArregloPagoBadge from "@/app/components/arreglos/ArregloPagoBadge";
import Avatar from "@/app/components/ui/Avatar";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { ROUTES } from "@/routing/routes";
import { logger } from "@/lib/logger";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import type { EstadoArreglo } from "@/model/types";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { useArregloPrintableInvoice } from "@/app/components/arreglos/hooks/useArregloPrintableInvoice";
import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";
import ArregloCategoriasList from "@/app/components/arreglos/ArregloCategoriasList";

export interface ArregloSummaryCardProps {
  data: ArregloDetalleData;
  totalCalculado: number;
  onOpenEdit: () => void;
  onArregloChange: (updatedArreglo: NonNullable<ArregloDetalleData["arreglo"]>) => void;
}

const EMPLEADO_COLORS = [
  { bg: "#eef2ff", text: "#4338ca", border: "#e0e7ff", avatarBg: "#c7d2fe", avatarText: "#312e81" }, // indigo
  { bg: "#f0fdfa", text: "#0f766e", border: "#ccfbf1", avatarBg: "#99f6e4", avatarText: "#134e4a" }, // teal
  { bg: "#fff1f2", text: "#be123c", border: "#ffe4e6", avatarBg: "#fecdd3", avatarText: "#881337" }, // rose
  { bg: "#fffbeb", text: "#b45309", border: "#fef3c7", avatarBg: "#fde68a", avatarText: "#78350f" }, // amber
];

export default function ArregloSummaryCard({
  data,
  totalCalculado,
  onOpenEdit,
  onArregloChange,
}: ArregloSummaryCardProps) {
  const router = useRouter();
  const { update, remove, loading } = useArreglos();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();
  const { handleOpenPrintableInvoice } = useArregloPrintableInvoice();
  const { shareArreglo } = useWhatsAppMessage();
  const { empleados } = useEmpleados();
  const { categorias } = useCategoriasArreglo();

  const assignedEmpleados = useMemo(() => {
    const ids = new Set<string>();
    data.detalles.forEach((d) => {
      if (d.empleado_id) ids.add(d.empleado_id);
    });
    data.asignaciones.forEach((a) => {
      a.lineas.forEach((l) => {
        if (l.empleado_id) ids.add(l.empleado_id);
      });
    });
    return Array.from(ids)
      .map((id) => empleados.find((e) => e.id === id))
      .filter(Boolean);
  }, [data, empleados]);

  const assignedTipos = useMemo(() => {
    const ids = new Set<string>();
    data.detalles.forEach((d) => {
      if (d.categoria_arreglo_id) ids.add(d.categoria_arreglo_id);
    });
    data.asignaciones.forEach((a) => {
      a.lineas.forEach((l) => {
        if (l.categoria_arreglo_id) ids.add(l.categoria_arreglo_id);
      });
    });
    const foundTipos = Array.from(ids)
      .map((id) => categorias.find((t) => t.id === id))
      .filter(Boolean);

    return foundTipos;
  }, [data, categorias]);

  const arreglo = data.arreglo;
  if (!arreglo) return null;

  const handlePrintableInvoice = () => {
    handleOpenPrintableInvoice(data);
  };

  const handleWhatsApp = () => {
    shareArreglo(data);
  };

  const handleNavigateToVehiculo = () => {
    if (arreglo.vehiculo) {
      router.push(`${ROUTES.vehiculos}/${arreglo.vehiculo.id}`);
    }
  };

  const handleDeleteArreglo = async () => {
    const confirmed = await confirm({
      message: "¿Estás seguro de que deseas eliminar este arreglo?",
      title: "Eliminar arreglo",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await remove(arreglo.id);
      router.push(ROUTES.arreglos);
      success("Arreglo eliminado", "El arreglo se eliminó correctamente.");
    } catch (err: unknown) {
      logger.error("Error deleting arreglo:", err);
      error("Error", "No se pudo eliminar el arreglo");
    }
  };

  const handleEstadoChange = async (nextEstado: EstadoArreglo) => {
    if (loading || arreglo.estado === nextEstado) return;

    try {
      const response = await update(arreglo.id, {
        estado: nextEstado,
      });
      if (!response) return;
      onArregloChange(response);
      success("Estado actualizado", "El estado del arreglo se actualizó correctamente.");
    } catch (err: unknown) {
      logger.error("Error updating arreglo estado:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar el estado del arreglo."
      );
    }
  };


  return (
    <section style={styles.container}>
      <Card style={styles.card}>
        {/* Top Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            {/* Vehículo info */}
            {arreglo.vehiculo ? (
              <Card
                style={styles.vehiculoCard}
                onClick={handleNavigateToVehiculo}
                role="button"
                tabIndex={0}
              >
                <div style={styles.vehiculoPatenteRow}>
                  <CarFront size={16} color={COLOR.ICON.MUTED} />
                  <span style={styles.patente}>{arreglo.vehiculo.patente}</span>
                </div>
                <div className="w-[1px] h-4 hidden sm:block" style={styles.divider} />
                <span className="text-sm font-medium hidden sm:block" style={styles.textSecondary}>
                  {arreglo.vehiculo.marca} {arreglo.vehiculo.modelo}
                  {arreglo.vehiculo.fecha_patente ? ` (${arreglo.vehiculo.fecha_patente})` : ""}
                </span>
                {arreglo.vehiculo.nro_interno && (
                  <>
                    <div className="w-[1px] h-4 hidden sm:block" style={styles.divider} />
                    <span className="text-xs font-medium uppercase tracking-wider hidden sm:block" style={styles.textTertiary}>
                      INT: {arreglo.vehiculo.nro_interno}
                    </span>
                  </>
                )}
              </Card>
            ) : (
              <span style={styles.noVehiculoText}>Sin vehículo</span>
            )}

            <span className="hidden md:block" style={styles.pipe}>|</span>

            {/* Estado */}
            <div style={styles.estadoRow}>
              <ArregloEstadoBadge
                estado={arreglo.estado}
                onStateChange={handleEstadoChange}
              />
              <div style={styles.paymentStatus}>
                <ArregloPagoBadge
                  estaPago={arreglo.esta_pago}
                  arregloId={arreglo.id}
                  onPagoUpdated={onArregloChange}
                  size="md"
                />
              </div>
            </div>
          </div>

          <div style={styles.headerActions}>
            <IconButton
              icon={<Trash />}
              size={18}
              onClick={handleDeleteArreglo}
              title="Eliminar arreglo"
              ariaLabel="Eliminar arreglo"
              hoverColor={COLOR.SEMANTIC.DANGER}
            />
            <IconButton
              icon={<FileText />}
              size={18}
              onClick={handlePrintableInvoice}
              title="Generar PDF"
              ariaLabel="Generar PDF"
              hoverColor={COLOR.ACCENT.PRIMARY}
            />
            <IconButton
              icon={<WhatsAppIcon size={18} />}
              size={18}
              onClick={handleWhatsApp}
              title="Enviar WhatsApp"
              ariaLabel="Enviar WhatsApp"
              hoverColor={COLOR.SEMANTIC.SUCCESS}
            />
            <IconButton
              icon={<Pencil />}
              size={18}
              onClick={onOpenEdit}
              title="Editar arreglo"
              ariaLabel="Editar arreglo"
              hoverColor={COLOR.ACCENT.PRIMARY}
            />
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 lg:p-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Block 1: Amount, Date, Mileage */}
            <div style={styles.block1}>
              <div>
                <span style={styles.blockLabel}>Total Estimado</span>
                <div style={styles.totalAmount}>
                  {formatArs(totalCalculado, { maxDecimals: 0, minDecimals: 0 })}
                </div>
              </div>
              <div className="grid gap-3" style={styles.detailsGrid}>
                <div style={styles.detailBox}>
                  <span style={styles.blockLabel}>Ingreso</span>
                  <div style={styles.detailValue}>
                    <Calendar size={16} color={COLOR.ICON.MUTED} />
                    {arreglo.fecha ? formatDateLabel(arreglo.fecha) : "-"}
                  </div>
                </div>
                <div style={styles.detailBox}>
                  <span style={styles.blockLabel}>Kilometraje</span>
                  <div style={styles.detailValue}>
                    <Gauge size={16} color={COLOR.ICON.MUTED} />
                    {arreglo.kilometraje_leido
                      ? `${arreglo.kilometraje_leido.toLocaleString()} km`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2: Categories and Personnel */}
            <div style={styles.block2}>
              <div>
                <span style={styles.blockLabelWithIcon}>
                  <Wrench size={14} /> Categorías de Arreglo
                </span>
                <ArregloCategoriasList
                  categorias={arreglo.categorias?.map((id) => categorias.find((t) => t.id === id)) ?? []}
                  size="md"
                  limit={3}
                  emptyText="Sin categorías registradas"
                />
              </div>

              <div>
                <span style={styles.blockLabelWithIcon}>
                  <Users size={14} /> Personal Asignado
                </span>
                <div style={styles.chipsRow}>
                  {assignedEmpleados.length > 0 ? (
                    assignedEmpleados.map((emp, idx) => {
                      if (!emp) return null;
                      const color = EMPLEADO_COLORS[idx % EMPLEADO_COLORS.length];
                      return (
                        <span
                          key={emp.id}
                          style={{
                            ...styles.empleadoChip,
                            backgroundColor: color.bg,
                            color: color.text,
                            borderColor: color.border,
                          }}
                        >
                          <Avatar
                            nombre={`${emp.nombre} ${emp.apellido || ""}`}
                            size={20}
                            bgColor={color.avatarBg}
                            textColor={color.avatarText}
                          />
                          {emp.nombre} {emp.apellido}
                        </span>
                      );
                    })
                  ) : (
                    <span style={styles.emptyText}>Sin personal asignado</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Block 3: Observations */}
          {arreglo.observaciones && (
            <div style={styles.observationsContainer}>
              <span style={styles.blockLabel}>Observaciones Generales</span>
              <p style={styles.observationsText}>{arreglo.observaciones}</p>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    marginTop: 16,
    fontFamily: "var(--font-geist-sans), sans-serif",
  },
  card: {
    padding: 0,
    overflow: "hidden",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
  header: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "12px 16px",
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerLeft: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: 12,
  },
  vehiculoCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    padding: "6px 12px",
    gap: 12,
  },
  vehiculoPatenteRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  patente: {
    fontFamily: "monospace",
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
  },
  divider: {
    backgroundColor: COLOR.BORDER.DEFAULT,
  },
  textSecondary: {
    color: COLOR.TEXT.SECONDARY,
  },
  textTertiary: {
    color: COLOR.TEXT.TERTIARY,
  },
  noVehiculoText: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
  },
  pipe: {
    color: COLOR.BORDER.DEFAULT,
  },
  estadoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  paymentStatus: {
    display: "flex",
    alignItems: "center",
    paddingLeft: 12,
    borderLeft: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  block1: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  blockLabel: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  },
  blockLabelWithIcon: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    letterSpacing: "0.05em",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    letterSpacing: "-0.025em",
  },
  detailsGrid: {
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  },
  detailBox: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 12,
  },
  detailValue: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap" as const,
  },
  block2: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  empleadoChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    border: "1px solid",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.TERTIARY,
    fontStyle: "italic",
  },
  observationsContainer: {
    paddingTop: 20,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  observationsText: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    margin: 0,
    lineHeight: 1.5,
  },
} as const;
