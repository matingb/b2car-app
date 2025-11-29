"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { Calendar, Wrench, Coins, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import VehiculoInfoCard from "@/app/components/vehiculos/VehiculoInfoCard";
import IconLabel from "@/app/components/ui/IconLabel";
import Card from "@/app/components/ui/Card";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { ROUTES } from "@/routing/routes";

export default function ArregloDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [arreglo, setArreglo] = useState<Arreglo | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const { fetchById, update, loading } = useArreglos();

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

  const togglePago = async () => {
    if (!arreglo) return;
    try {
      const response = await update(arreglo.id, { esta_pago: !arreglo.esta_pago }, arreglo.vehiculo);
      if (!response) return;
      setArreglo(response);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  if (loading) return loadingScreen();

  if (!arreglo) {
    return (
      <div>
        <ScreenHeader title="Arreglos" breadcrumbs={["Detalle"]} hasBackButton/>
        <div style={{ marginTop: 16 }}>Arreglo no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ScreenHeader title="Arreglos" breadcrumbs={["Detalle"]} hasBackButton/>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 320, gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Resumen</h3>
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                {arreglo.esta_pago ? (
                    <>
                      Pagado
                    </>
                  ) : (
                    <>
                      Pendiente
                    </>
                  )}
                <button onClick={togglePago} style={styles.iconBtn} aria-label="toggle pago">
                  {arreglo.esta_pago ? (
                    <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />
                  ) : (
                    <XCircle size={18} color={COLOR.ICON.DANGER} />
                  )}
                </button>
                
                <button onClick={handleOpenEdit} style={styles.iconBtn} aria-label="editar">
                  <Pencil size={18} color={COLOR.ACCENT.PRIMARY} />
                </button>
              </div>
            </div>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, color: COLOR.ICON.MUTED, marginBottom: 4 }}>Fecha</div>
                    <IconLabel
                      icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={arreglo.fecha ? new Date(arreglo.fecha).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 14, color: COLOR.ICON.MUTED, marginBottom: 4 }}>Tipo</div>
                    <IconLabel icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />} label={arreglo.tipo || "-"} />
                  </div>

                  <div>
                    <div style={{ fontSize: 14, color: COLOR.ICON.MUTED, marginBottom: 4 }}>Precio</div>
                    <IconLabel icon={<Coins size={18} color={COLOR.ACCENT.PRIMARY} />} label={`$${arreglo.precio_final}`} />
                  </div>
                </div>

                {arreglo.descripcion && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700 }}>Descripción</div>
                    <div style={{ color: "rgba(0,0,0,0.8)" }}>{arreglo.descripcion}</div>
                  </div>
                )}

                {arreglo.observaciones && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700 }}>Observaciones</div>
                    <div style={{ color: "rgba(0,0,0,0.8)" }}>{arreglo.observaciones}</div>
                  </div>
                )}
              </div>
            </Card>
            {arreglo.vehiculo && (
              <VehiculoInfoCard vehiculo={arreglo.vehiculo} onEdit={() => { }} maxKilometraje={arreglo.kilometraje_leido} onClick={handleNavigateToVehiculo}/>
            )}
          </div>
        </div>
      </div>

      {arreglo && arreglo.vehiculo && (
        <ArregloModal
          open={openModal}
          onClose={handleCloseModal}
          onSubmitSuccess={(updatedArreglo) => setArreglo(updatedArreglo)}
          vehiculoId={arreglo.vehiculo.id}
          vehiculo={arreglo.vehiculo}
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
        <ScreenHeader title="Arreglos" breadcrumbs={["Detalle"]} hasBackButton/>

        <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "row", alignItems: "center" }}>
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "column", alignItems: "start", width: "50%" }}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "column", alignItems: "start", width: "50%" }}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>

        <div style={{ flex: 1, marginTop: 32, gap: 24, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
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
} as const;
