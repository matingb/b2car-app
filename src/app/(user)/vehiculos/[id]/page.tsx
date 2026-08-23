"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Vehiculo, Arreglo, Cliente } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { Skeleton, Theme } from "@radix-ui/themes";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import EditVehiculoModal from "@/app/components/vehiculos/EditVehiculoModal";
import VehiculoInfoCard from "@/app/components/vehiculos/VehiculoInfoCard";
import PropietarioCard from "@/app/components/vehiculos/PropietarioCard";
import ReassignPropietarioModal from "@/app/components/vehiculos/ReassignPropietarioModal";
import { ROUTES } from "@/routing/routes";
import { vehiculoClient } from "@/clients/vehiculoClient";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { css } from "@emotion/react";
import ArregloFiltersModal from "@/app/components/arreglos/ArregloFiltersModal";
import ArreglosToolbar from "@/app/components/arreglos/ArreglosToolbar";
import ArreglosResults from "@/app/components/arreglos/ArreglosResults";
import { useArreglosFilters } from "@/app/hooks/arreglos/useArreglosFilters";

export default function VehiculoDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [editArreglo, setEditArreglo] = useState<Arreglo | null>(null);
  const [openEditVehiculo, setOpenEditVehiculo] = useState(false);
  const [openReassignOwner, setOpenReassignOwner] = useState(false);
  const { confirm, alert } = useModalMessage();
  const [isArreglosFilterModalOpen, setIsArreglosFilterModalOpen] = useState(false);
  const arreglosFilters = useArreglosFilters(arreglos);

  // Kilometraje más alto a partir de los arreglos
  const maxKilometraje = useMemo(() => {
    if (!arreglos || arreglos.length === 0) return undefined;
    return Math.max(...arreglos.map((a) => Number(a.kilometraje_leido) || 0));
  }, [arreglos]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, arreglos, error } = await vehiculoClient.getById(params.id);
      if (error) {
        setError(error);
        setVehiculo(null);
        setArreglos([]);
        return;
      }

      if (!data) {
        setVehiculo(null);
        setArreglos([]);
      } else {
        setVehiculo(data);
        setArreglos(arreglos || []);

        const clienteResponse = await vehiculoClient.getClienteForVehiculo(params.id);
        if (clienteResponse.data) {
          setCliente(clienteResponse.data);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el vehículo");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenCreate = () => {
    setEditArreglo(null);
    setOpenModal(true);
  };

  const handleCloseModal = (updated?: boolean) => {
    setOpenModal(false);
    setEditArreglo(null);
    if (updated) {
      void load();
    }
  };

  const handleCloseEditVehiculo = (updated?: boolean) => {
    setOpenEditVehiculo(false);
    if (updated) {
      void load();
    }
  };

  const handleCloseReassignOwner = (updated?: boolean) => {
    setOpenReassignOwner(false);
    if (updated) {
      void load();
    }
  };

  const handleDeleteVehiculo = async () => {
    const confirmed = await confirm({
      title: "Confirmar eliminación",
      message: `¿Estás seguro de que deseas eliminar el vehículo ${vehiculo?.patente}? Esta acción no se puede deshacer.`,
    });
    if (!confirmed) return;
    try {
      setLoading(true);
      const err = await vehiculoClient.delete(vehiculo!.id);
      if (err.error) throw new Error(err.error);
      router.push(ROUTES.vehiculos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error";
      alert({
        title: "Error",
        message: `No se pudo eliminar el vehículo. ${msg}`,
      });
    } finally {
      setLoading(false);
    }
  };


  const handleNavigateToCliente = () => {
    if (cliente) {
      // Guardar tipo de cliente en localStorage para que la página de detalle sepa qué endpoint usar
      localStorage.setItem("tipo_cliente", cliente.tipo_cliente);
      router.push(`${ROUTES.clientes}/${cliente.id}`);
    }
  };

  if (loading) {
    return (
      <div>
        <ScreenHeader title="Vehículo" hasBackButton />
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          Cargando...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ScreenHeader title="Vehículo" hasBackButton />
        <div style={styles.notFoundText}>{error}</div>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div>
        <ScreenHeader title="Vehículo" hasBackButton />
        <div style={styles.notFoundText}>No se encontró el vehículo solicitado.</div>
      </div>
    );
  }

  return (
    <div>
      <div css={styles.headerRow}>
        <ScreenHeader
          title={`${vehiculo.patente} - ${vehiculo.marca} ${vehiculo.modelo}`}
          breadcrumbs={["Detalle"]}
          hasBackButton
        />
      </div>
      <div css={styles.headerRowMobile}>
        <ScreenHeader
          title={`${vehiculo.patente}`}
          breadcrumbs={["Detalle"]}
          hasBackButton
        />
      </div>

      <div style={styles.mainContainer}>
        {/* Bloques superiores: Información del Vehículo y Propietario */}
        <div style={styles.topBlocks}>
          <VehiculoInfoCard
            css={styles.vehiculoInfoCard}
            vehiculo={vehiculo}
            maxKilometraje={maxKilometraje}
            onDelete={() => handleDeleteVehiculo()}
            onEdit={() => setOpenEditVehiculo(true)}
            showDelete={true}
            showEdit={true}
          />

          {cliente && (
            <PropietarioCard
              css={styles.propietarioCard}
              cliente={cliente}
              onClick={handleNavigateToCliente}
              onReassign={() => setOpenReassignOwner(true)}
            />
          )}
        </div>

        <div style={styles.arreglosHeader}>
          <h3 css={styles.arreglosTitle}>Ultimos arreglos</h3>
        </div>
        <ArreglosToolbar
          search={arreglosFilters.search}
          onSearchChange={arreglosFilters.setSearch}
          onOpenFilters={() => setIsArreglosFilterModalOpen(true)}
          onOpenCreate={handleOpenCreate}
          chips={arreglosFilters.chips}
          onChipClick={arreglosFilters.removeFilter}
          onClearFilters={arreglosFilters.clearFilters}
        />

        <ArreglosResults
          loading={false}
          items={arreglosFilters.arreglosFiltrados}
          onSelect={(a) => router.push(`/arreglos/${a.id}`)}
          showObservaciones={true}
        />
      </div>
      <ArregloFiltersModal
        open={isArreglosFilterModalOpen}
        onClose={() => setIsArreglosFilterModalOpen(false)}
        onApply={arreglosFilters.applyFilters}
        initial={arreglosFilters.filters}
      />
      {vehiculo && (
        <ArregloModal
          open={openModal}
          vehiculoId={vehiculo.id}
          initial={
            editArreglo
              ? {
                id: editArreglo.id,
                fecha: editArreglo.fecha,
                kilometraje_leido: editArreglo.kilometraje_leido,
                precio_final: editArreglo.precio_final,
                observaciones: editArreglo.observaciones,
                descripcion: editArreglo.descripcion,
                esta_pago: editArreglo.esta_pago,
                extra_data: editArreglo.extra_data,
              }
              : undefined
          }
          onClose={handleCloseModal}
          onSubmitSuccess={async () => {
            await handleCloseModal(true);
          }}
        />
      )}
      {vehiculo && (
        <EditVehiculoModal
          open={openEditVehiculo}
          onClose={handleCloseEditVehiculo}
          vehiculo={vehiculo}
          tipoCliente={cliente?.tipo_cliente}
        />
      )}
      {vehiculo && (
        <ReassignPropietarioModal
          open={openReassignOwner}
          vehiculoId={vehiculo.id}
          currentClienteId={cliente?.id}
          onClose={handleCloseReassignOwner}
        />
      )}
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={styles.loadingRoot}>
      <Theme style={styles.loadingTheme}>
        <ScreenHeader title="Vehículos" breadcrumbs={["Detalle"]} />

        <div style={styles.loadingHeaderRow}>
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>
        <div style={styles.loadingTopRow}>
          <div style={styles.loadingColumnHalf}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div style={styles.loadingColumnHalf}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>
        <div style={styles.loadingList}>
          <Skeleton width="100%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="90%" height="16px" />
        </div>
      </Theme>
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    display: "flex",
    justifyContent: "start",
    marginTop: 8,
    gap: 16,
  },
  searchBar: {
    width: "100%",
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  },
  headerRowMobile: css({
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "start",
    gap: 16,
    marginTop: 16,
  },
  topBlocks: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  vehiculoInfoCard: css({
    width: "70%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
    },
  }),
  propietarioCard: css({
    width: "30%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
    },
  }),
  arreglosHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap  : "wrap",
    gap: 8
  },
  arreglosTitle: css({
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 0,
    width: '100%',
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 18,
    },
  }),
  notFoundText: {
    marginTop: 16,
  },
  loadingRoot: {
    maxHeight: "100%",
    minHeight: "0vh",
  },
  loadingTheme: {
    height: "100%",
    minHeight: "0vh",
  },
  loadingHeaderRow: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  loadingTopRow: {
    display: "flex",
    gap: 16,
    marginTop: 16,
  },
  loadingColumnHalf: {
    flex: 1,
    marginTop: 16,
    gap: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "start",
    width: "50%",
  },
  loadingList: {
    flex: 1,
    marginTop: 32,
    gap: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
} as const;
