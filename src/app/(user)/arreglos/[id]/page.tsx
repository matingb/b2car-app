"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import {
  Calendar,
  Wrench,
  Coins,
  Pencil,
  CheckCircle2,
  XCircle,
  Trash,
  Gauge,
} from "lucide-react";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import VehiculoInfoCard from "@/app/components/vehiculos/VehiculoInfoCard";
import IconLabel from "@/app/components/ui/IconLabel";
import Card from "@/app/components/ui/Card";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { ROUTES } from "@/routing/routes";
import IconButton from "@/app/components/ui/IconButton";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { logger } from "@/lib/logger";

export default function ArregloDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [arreglo, setArreglo] = useState<Arreglo | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const { fetchById, update, remove, loading } = useArreglos();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();

  const reload = useCallback(async () => {
    try {
      const arreglo = await fetchById(params.id);
      if (!arreglo) return;
      setArreglo(arreglo);
    } catch (err: unknown) {
      console.error(err);
    }
  }, [params.id, fetchById]);

  useEffect(() => {
    async function load() {
      await reload();
    }
    load();
  }, [params.id, reload]);

  const handleOpenEdit = () => {
    setOpenModal(true);
  };

  const handleCloseModal = async () => {
    setOpenModal(false);
  };

  const handleNavigateToVehiculo = () => {
    if (arreglo?.vehiculo) {
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
    if (!arreglo) return;
    try {
      await remove(arreglo.id);
      router.push(ROUTES.arreglos);
      success("Éxito", "El arreglo ha sido eliminado.");
    } catch (err: unknown) {
      logger.error("Error deleting arreglo:", err);
      error("Error", "No se pudo eliminar el arreglo");
    }
  };

  const togglePago = async () => {
    if (!arreglo) return;
    try {
      const response = await update(arreglo.id, {
        esta_pago: !arreglo.esta_pago,
      });
      if (!response) return;
      setArreglo(response);
      success("Éxito", "El estado de pago ha sido actualizado.");
    } catch (err: unknown) {
      console.error(err);
      error("Error", "No se pudo actualizar el estado de pago.");
    }
  };

  if (loading) return loadingScreen();

  if (!arreglo) {
    return (
      <div>
        <ScreenHeader
          title="Arreglos"
          breadcrumbs={["Detalle"]}
          hasBackButton
        />
        <div style={{ marginTop: 16 }}>Arreglo no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16}}>
        <ScreenHeader
          title="Arreglos"
          breadcrumbs={["Detalle"]}
          hasBackButton
          style={{ width: "100%" }}
        />
      </div>

      <div style={styles.container}>
        <div style={styles.flexRow}>
          <div style={styles.summaryContainer}>
            <div style={{ display: "flex", gap: 8 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                Resumen
              </h3>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {arreglo.esta_pago ? <>Pagado</> : <>Pendiente</>}
                <button
                  onClick={togglePago}
                  style={styles.iconBtn}
                  aria-label="toggle pago"
                >
                  {arreglo.esta_pago ? (
                    <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />
                  ) : (
                    <XCircle size={18} color={COLOR.ICON.DANGER} />
                  )}
                </button>

                <IconButton
                  icon={<Trash />}
                  size={18}
                  onClick={handleDeleteArreglo}
                  title="Editar vehículo"
                  ariaLabel="Editar vehículo"
                />

                <IconButton
                  icon={<Pencil />}
                  size={18}
                  onClick={handleOpenEdit}
                  title="Editar vehículo"
                  ariaLabel="Editar vehículo"
                />
              </div>
            </div>
            <Card>
              <div style={styles.cardContent}>
                <div style={styles.infoGrid}>
                  <div>
                    <div style={styles.fieldLabel}>
                      Fecha
                    </div>
                    <IconLabel
                      icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={
                        arreglo.fecha
                          ? new Date(arreglo.fecha).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : ""
                      }
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>
                      Tipo
                    </div>
                    <IconLabel
                      icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={arreglo.tipo || "-"}
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>
                      Precio
                    </div>
                    <IconLabel
                      icon={<Coins size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={`$${arreglo.precio_final}`}
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>
                      Kilometraje
                    </div>
                    <IconLabel
                      icon={<Gauge size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={
                        arreglo.kilometraje_leido
                          ? `${arreglo.kilometraje_leido.toLocaleString()} km`
                          : "N/A"
                      }
                    />
                  </div>
                </div>

                {arreglo.descripcion && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700 }}>Descripción</div>
                    <div style={{ color: "rgba(0,0,0,0.8)", whiteSpace: "pre-wrap" }}>
                      {arreglo.descripcion}
                    </div>
                  </div>
                )}

                {arreglo.observaciones && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700 }}>Observaciones</div>
                    <div style={{ color: "rgba(0,0,0,0.8)" }}>
                      {arreglo.observaciones}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            {arreglo.vehiculo && (
              <VehiculoInfoCard
                vehiculo={arreglo.vehiculo}
                onEdit={() => {}}
                maxKilometraje={arreglo.kilometraje_leido}
                onClick={handleNavigateToVehiculo}
              />
            )}
          </div>
        </div>
      </div>

      {arreglo && arreglo.vehiculo && (
        <ArregloModal
          open={openModal}
          onClose={handleCloseModal}
          onSubmitSuccess={async (nuevo) => {
            setArreglo(nuevo);
          }}
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
      )}
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={{ maxHeight: "100%", minHeight: "0vh" }}>
      <Theme style={{ height: "100%", minHeight: "0vh" }}>
        <ScreenHeader
          title="Arreglos"
          breadcrumbs={["Detalle"]}
          hasBackButton
        />

        <div style={styles.loadingContainer}>
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={styles.loadingColumn}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div style={styles.loadingColumn}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>

        <div style={styles.loadingFooter}>
          <Skeleton width="100%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="90%" height="16px" />
        </div>
      </Theme>
    </div>
  );
}

const styles = {
  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
  },
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    marginTop: 16,
  },
  flexRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  summaryContainer: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    
    gap: 8,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLOR.ICON.MUTED,
    marginBottom: 4,
  },
  cardContent: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
  },
  loadingColumn: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "start",
    width: "50%",
  },
  loadingFooter: {
    flex: 1,
    marginTop: 32,
    gap: 24,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    width: "100%",
  },
} as const;
