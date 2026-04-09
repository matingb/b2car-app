"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
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
import { APP_LOCALE, formatArs } from "@/lib/format";
import { assembleClientePhone, buildArregloWhatsappMessage } from "@/lib/whatsapp";
import { safeNumber } from "@/lib/numbers";
import type {
  ArregloDetalleData,
  AsignacionArregloLinea,
} from "@/app/api/arreglos/[id]/route";
import type { ArregloFormularioLineaValue } from "@/app/api/arreglos/arregloRequests";
import ServicioLineasEditableSection from "@/app/components/arreglos/lineas/ServicioLineasEditableSection";
import ServicioLineasCustomSection, {
  parseCustomServicioLineDefs,
} from "@/app/components/arreglos/lineas/ServicioLineasCustomSection";
import RepuestoLineasEditableSection from "@/app/components/arreglos/lineas/RepuestoLineasEditableSection";
import WhatsAppIcon from "@/app/components/ui/WhatsAppIcon";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
import { useFormularios } from "@/app/providers/FormulariosProvider";
import type { ServicioLinea } from "@/app/components/arreglos/lineas/ServicioLineasEditableSection";
import type { EstadoArreglo } from "@/model/types";
import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";

export default function ArregloDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ArregloDetalleData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [customServiciosDraft, setCustomServiciosDraft] = useState<ServicioLinea[]>([]);
  const {
    fetchById,
    update,
    remove,
    createDetalle,
    updateDetalle,
    deleteDetalle,
    upsertRepuestoLinea,
    deleteRepuestoLinea,
    loading,
  } = useArreglos();
  const { formularios } = useFormularios();
  const { fetchCliente } = useVehiculos();
  const { confirm } = useModalMessage();
  const { success, error } = useToast();
  const { share } = useWhatsAppMessage();

  const handleOpenWhatsapp = async () => {
    if (!data?.arreglo?.vehiculo?.id) {
      error("Error", "No se pudo identificar el vehículo");
      return;
    }

    const cliente = await fetchCliente(data.arreglo.vehiculo.id);
    const fullPhone = cliente ? assembleClientePhone(cliente) : "";
    if (!fullPhone) {
      error("Error", "El cliente no tiene teléfono cargado");
      return;
    }

    const tenantName = localStorage.getItem("tenant_name") || undefined;
    const mensaje = buildArregloWhatsappMessage(data, tenantName);
    if (!mensaje) {
      error("Error", "No se pudo generar el mensaje");
      return;
    }

    await share(mensaje, fullPhone);
  };

  const reload = useCallback(async (options?: { showPageLoading?: boolean }) => {
    const showPageLoading = options?.showPageLoading ?? false;
    if (showPageLoading) {
      setPageLoading(true);
    }
    try {
      const data = await fetchById(params.id);
      if (!data) return;
      setData(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      if (showPageLoading) {
        setPageLoading(false);
      }
    }
  }, [params.id, fetchById]);

  useEffect(() => {
    async function load() {
      await reload({ showPageLoading: true });
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
    if (data?.arreglo?.vehiculo) {
      router.push(`${ROUTES.vehiculos}/${data.arreglo.vehiculo.id}`);
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
    if (!data?.arreglo) return;
    try {
      await remove(data.arreglo.id);
      router.push(ROUTES.arreglos);
      success("Arreglo eliminado", "El arreglo se eliminó correctamente.");
    } catch (err: unknown) {
      logger.error("Error deleting arreglo:", err);
      error("Error", "No se pudo eliminar el arreglo");
    }
  };

  const togglePago = async () => {
    if (!data?.arreglo) return;
    try {
      const response = await update(data.arreglo.id, {
        esta_pago: !data.arreglo.esta_pago,
      });
      if (!response) return;
      setData((prev) => (prev ? { ...prev, arreglo: response } : prev));
      success("Estado de pago actualizado", "El estado de pago se actualizó correctamente.");
    } catch (err: unknown) {
      console.error(err);
      error("Error", "No se pudo actualizar el estado de pago.");
    }
  };

  const handleEstadoChange = async (nextEstado: EstadoArreglo) => {
    if (!data?.arreglo || loading) return;
    if (data.arreglo.estado === nextEstado) return;

    try {
      const response = await update(data.arreglo.id, {
        estado: nextEstado,
      });
      if (!response) return;
      setData((prev) => (prev ? { ...prev, arreglo: response } : prev));
      success("Estado actualizado", "El estado del arreglo se actualizó correctamente.");
    } catch (err: unknown) {
      logger.error("Error updating arreglo estado:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar el estado del arreglo."
      );
    }
  };

  const handleDeleteServicio = async (detalleId: string) => {
    if (!data?.arreglo?.id) return;
    const confirmed = await confirm({
      title: "Eliminar servicio",
      message: "¿Querés eliminar este servicio del arreglo?",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await deleteDetalle(data.arreglo.id, detalleId);
      success("Servicio eliminado", "El servicio se eliminó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error deleting detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar el servicio"
      );
    }
  };

  const handleDeleteRepuesto = async (lineaId: string) => {
    if (!data?.arreglo?.id) return;
    const confirmed = await confirm({
      title: "Eliminar repuesto",
      message:
        "¿Querés eliminar este repuesto del arreglo? Esto devolverá el stock.",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;
    try {
      await deleteRepuestoLinea(data.arreglo.id, lineaId);
      success("Repuesto eliminado", "El repuesto se eliminó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error deleting repuesto linea:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar el repuesto"
      );
    }
  };

  const handleAddServicio = async (input: {
    descripcion: string;
    cantidad: number;
    valor: number;
  }) => {
    if (!data?.arreglo?.id) return;
    try {
      await createDetalle(data.arreglo.id, input);
      success("Servicio agregado", "La mano de obra se agregó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error creating detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo agregar el servicio"
      );
      throw err;
    }
  };

  const handleUpdateServicio = async (
    detalleId: string,
    patch: { descripcion: string; cantidad: number; valor: number }
  ) => {
    if (!data?.arreglo?.id) return;
    try {
      await updateDetalle(data.arreglo.id, detalleId, patch);
      success("Servicio actualizado", "El servicio se actualizó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error updating detalle:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar el servicio"
      );
      throw err;
    }
  };

  const handleUpsertRepuesto = async (input: {
    stock_id: string;
    cantidad: number;
    monto_unitario: number;
  }) => {
    if (!data?.arreglo?.id) return;
    const tallerId = data.arreglo.taller_id ?? null;
    if (!tallerId) return;
    try {
      await upsertRepuestoLinea(data.arreglo.id, {
        taller_id: tallerId,
        stock_id: input.stock_id,
        cantidad: input.cantidad,
        monto_unitario: input.monto_unitario,
      });
      success("Repuesto actualizado", "El repuesto se actualizó correctamente.");
      await reload();
    } catch (err: unknown) {
      logger.error("Error upserting repuesto:", err);
      error(
        "Error",
        err instanceof Error ? err.message : "No se pudo guardar el repuesto"
      );
      throw err;
    }
  };

  const selectedCustomFormulario = useMemo(() => {
    const tipo = String(data?.arreglo?.tipo ?? "").trim().toLowerCase();
    if (!tipo) return null;
    return (
      formularios.find(
        (formulario) => formulario.descripcion.trim().toLowerCase() === tipo
      ) ?? null
    );
  }, [data?.arreglo?.tipo, formularios]);
  const isCustomTipoSelected = Boolean(selectedCustomFormulario);
  const customLineDefs = useMemo(
    () => parseCustomServicioLineDefs(selectedCustomFormulario?.metadata),
    [selectedCustomFormulario]
  );

  useEffect(() => {
    setCustomServiciosDraft([]);
  }, [data?.arreglo?.id, isCustomTipoSelected]);

  if (pageLoading) return loadingScreen();

  if (!data?.arreglo) {
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

  const arreglo = data.arreglo;
  const detalles = Array.isArray(data.detalles) ? data.detalles : [];
  const repuestosLineas = flattenAsignacionesLineas(data);

  const subtotalServicios = detalles.reduce(
    (acc, d) => acc + safeNumber(d.valor) * safeNumber(d.cantidad),
    0
  );
  const subtotalServiciosCustom =
    customServiciosDraft.length > 0
      ? customServiciosDraft.reduce(
        (acc, s) => acc + safeNumber(s.valor) * safeNumber(s.cantidad),
        0
      )
      : safeNumber(data.detalle_formulario?.costo);
  const subtotalRepuestos = repuestosLineas.reduce(
    (acc, l) => acc + safeNumber(l.monto_unitario) * safeNumber(l.cantidad),
    0
  );
  const totalCalculado = subtotalServicios + subtotalServiciosCustom + subtotalRepuestos;

  const handleConfirmCustomEdit = async ({
    costo,
    metadata,
  }: {
    costo: number;
    metadata: ArregloFormularioLineaValue[];
  }) => {
    if (!data?.arreglo?.id) return;

    const nextPrecioFinal = subtotalServicios + costo + subtotalRepuestos;

    try {
      await update(data.arreglo.id, {
        precio_final: nextPrecioFinal,
        detalle_formulario: {
          formulario_id: selectedCustomFormulario?.id,
          costo,
          metadata,
        },
      });

      success(
        "Formulario actualizado",
        "Se actualizaron el arreglo y su detalle custom."
      );
      await reload();
    } catch (err: unknown) {
      logger.error("Error updating custom form detail:", err);
      error(
        "Error",
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el formulario custom"
      );
      throw err;
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
            <div css={styles.mobileSummaryHeader}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                Resumen
              </h3>
              <div css={styles.mobileSummaryStatusRow}>
                <ArregloEstadoBadge
                  estado={arreglo.estado}
                  onStateChange={handleEstadoChange}
                />
                <div style={styles.paymentStatus}>
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
                </div>
              </div>
            </div>

            <div css={styles.desktopSummaryRow}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                Resumen
              </h3>
              <ArregloEstadoBadge
                estado={arreglo.estado}
                onStateChange={handleEstadoChange}
              />
              <div style={styles.desktopSummaryActions}>
                <div style={styles.paymentStatus}>
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
                </div>
                <IconButton
                  icon={<WhatsAppIcon size={18} />}
                  size={18}
                  onClick={handleOpenWhatsapp}
                  title="Enviar WhatsApp"
                  ariaLabel="Enviar WhatsApp"
                  hoverColor={COLOR.ACCENT.PRIMARY}
                />
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

            <div css={styles.summaryActionsRow}>
              <IconButton
                icon={<WhatsAppIcon size={18} />}
                size={18}
                onClick={handleOpenWhatsapp}
                title="Enviar WhatsApp"
                ariaLabel="Enviar WhatsApp"
                hoverColor={COLOR.ACCENT.PRIMARY}
              />
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
            <Card>
              <div style={styles.cardContent}>
                <div style={styles.infoGrid}>
                  <div>
                    <div style={styles.fieldLabel}>Fecha</div>
                    <IconLabel
                      icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={
                        arreglo.fecha
                          ? new Date(arreglo.fecha).toLocaleString(APP_LOCALE, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                          : ""
                      }
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>Tipo</div>
                    <IconLabel
                      icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={arreglo.tipo || "-"}
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>Precio</div>
                    <IconLabel
                      icon={<Coins size={18} color={COLOR.ACCENT.PRIMARY} />}
                      label={formatArs(totalCalculado, {
                        maxDecimals: 0,
                        minDecimals: 0,
                      })}
                    />
                  </div>

                  <div>
                    <div style={styles.fieldLabel}>Kilometraje</div>
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
                onEdit={() => { }}
                maxKilometraje={arreglo.kilometraje_leido}
                onClick={handleNavigateToVehiculo}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.detalleHeader}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Detalle del Arreglo
            </h3>
            <div style={{ color: COLOR.TEXT.SECONDARY, marginTop: 2 }}>
              Servicios y productos incluidos
            </div>
          </div>
        </div>
        {isCustomTipoSelected ? (
          <>
            <ServicioLineasCustomSection
              formTitle={selectedCustomFormulario?.descripcion}
              defaultCosto={selectedCustomFormulario?.costoDefault}
              lineDefs={customLineDefs}
              initialDetalle={data.detalle_formulario}
              editableOnLoad={false}
              showEditButton
              disabled={loading}
              onServiciosChange={setCustomServiciosDraft}
              onConfirmEdit={handleConfirmCustomEdit}
            />
            <div style={styles.divider} />
          </>
        ) : null}
        <ServicioLineasEditableSection
          items={detalles.map((d) => ({
            id: d.id,
            descripcion: d.descripcion,
            cantidad: safeNumber(d.cantidad),
            valor: safeNumber(d.valor),
          }))}
          onAdd={handleAddServicio}
          onUpdate={handleUpdateServicio}
          onDelete={handleDeleteServicio}
          disabled={loading}
        />
        <div
          style={{
            height: 1,
            background: COLOR.BORDER.SUBTLE,
            margin: "12px 0",
          }}
        />

        <RepuestoLineasEditableSection
          tallerId={arreglo.taller_id ?? null}
          items={repuestosLineas.map((l) => ({
            id: l.id,
            stock_id: l.stock_id,
            cantidad: safeNumber(l.cantidad),
            monto_unitario: safeNumber(l.monto_unitario),
            producto: l.producto ? { nombre: l.producto.nombre, codigo: l.producto.codigo } : null,
          }))}
          onUpsert={handleUpsertRepuesto}
          onDelete={handleDeleteRepuesto}
          disabled={loading}
        />

        <div style={styles.totalFooter}>
          <div style={styles.totalsRow}>
            <div style={styles.totalsLeft}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.dotBlue} />
                <span style={{ color: COLOR.TEXT.SECONDARY }}>Servicios:</span>
                <span style={{ fontWeight: 600 }}>
                  {formatArs(subtotalServicios + subtotalServiciosCustom, {
                    maxDecimals: 0,
                    minDecimals: 0,
                  })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.dotGreen} />
                <span style={{ color: COLOR.TEXT.SECONDARY }}>Productos:</span>
                <span style={{ fontWeight: 600 }}>
                  {formatArs(subtotalRepuestos, {
                    maxDecimals: 0,
                    minDecimals: 0,
                  })}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ color: COLOR.TEXT.SECONDARY }}>
                Total del arreglo
              </div>
              <div style={styles.totalBig}>
                {formatArs(totalCalculado, {
                  maxDecimals: 0,
                  minDecimals: 0,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {arreglo && arreglo.vehiculo && (
        <ArregloModal
          open={openModal}
          onClose={handleCloseModal}
          onSubmitSuccess={async (nuevo) => {
            setData((prev) => (prev ? { ...prev, arreglo: nuevo } : prev));
            //await reload();
          }}
          vehiculoId={arreglo.vehiculo.id}
          initial={{
            id: arreglo.id,
            tipo: arreglo.tipo,
            estado: arreglo.estado,
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
  divider: {
    height: 1,
    background: COLOR.BORDER.SUBTLE,
    margin: "18px 0",
  },
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
  mobileSummaryHeader: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
    },
  }),
  mobileSummaryStatusRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  }),
  desktopSummaryRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  desktopSummaryActions: {
    flex: 1,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  summaryActionsRow: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      gap: 4,
    },
  }),
  paymentStatus: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },  detalleHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  sectionTitle: {
    paddingTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 10,
  },
  emptyState: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.03)",
    color: "rgba(0,0,0,0.55)",
    fontWeight: 600,
  },
  itemCardBlue: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  itemCardGreen: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  itemIconCircleBlue: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLOR.BACKGROUND.SUBTLE,
  },
  itemIconCircleGreen: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(22, 163, 74, 0.14)",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  itemSubTitle: {
    marginTop: 6,
    color: "rgba(0,0,0,0.55)",
    fontWeight: 600,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
    marginLeft: 8,
  },
  deleteBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
  },
  codePill: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 800,
    color: "rgba(0,0,0,0.7)",
    background: "rgba(255,255,255,0.8)",
    whiteSpace: "nowrap" as const,
  },
  subtotalRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 8,
  },
  subtotalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
  },
  subtotalValue: {
    fontWeight: 800,
    fontSize: 16,
  },
  totalFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  totalsRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  totalsLeft: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap" as const,
  },
  dotBlue: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: COLOR.ACCENT.PRIMARY,
    display: "inline-block",
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#16a34a",
    display: "inline-block",
  },
  totalBig: {
    fontSize: 32,
    fontWeight: 700,
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

function flattenAsignacionesLineas(
  data: ArregloDetalleData
): AsignacionArregloLinea[] {
  if (!Array.isArray(data.asignaciones)) return [];
  const out: AsignacionArregloLinea[] = [];
  for (const op of data.asignaciones) {
    if (!op || !Array.isArray(op.lineas)) continue;
    for (const l of op.lineas) {
      if (!l) continue;
      out.push(l);
    }
  }
  return out;
}




