"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Vehiculo, Arreglo, Cliente } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { ArrowLeft } from "lucide-react";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import EditVehiculoModal from "@/app/components/vehiculos/EditVehiculoModal";
import VehiculoInfoCard from "@/app/components/vehiculos/VehiculoInfoCard";
import PropietarioCard from "@/app/components/vehiculos/PropietarioCard";
import ArreglosList from "@/app/components/arreglos/ArreglosList";
import { ROUTES } from "@/routing/routes";

type VehiculoResponse = {
  data: Vehiculo | null;
  arreglos?: Arreglo[];
  error?: string | null;
};

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

  // Kilometraje más alto a partir de los arreglos
  const maxKilometraje = useMemo(() => {
    if (!arreglos || arreglos.length === 0) return undefined;
    return Math.max(...arreglos.map((a) => Number(a.kilometraje_leido) || 0));
  }, [arreglos]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/vehiculos/${params.id}`);
      const body: VehiculoResponse = await res.json();
      if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
      setVehiculo(body.data);
      setArreglos(body.arreglos || []);
      
      const clienteRes = await fetch(`/api/vehiculos/${params.id}/cliente`);
      if (clienteRes.ok) {
        const clienteBody = await clienteRes.json();
        setCliente(clienteBody.data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo cargar el vehículo";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    async function load() {
      await reload();
    }
    load();
  }, [params.id, reload]);

  const handleOpenCreate = () => {
    setEditArreglo(null);
    setOpenModal(true);
  };
  const handleOpenEdit = (a: Arreglo) => {
    setEditArreglo(a);
    setOpenModal(true);
  };
  const handleCloseModal = async (updated?: boolean) => {
    setOpenModal(false);
    setEditArreglo(null);
    if (updated) await reload();
  };
  
  const handleCloseEditVehiculo = async (updated?: boolean) => {
    setOpenEditVehiculo(false);
    if (updated) await reload();
  };

  const togglePago = async (a: Arreglo) => {
    try {
      const res = await fetch(`/api/arreglos/${a.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esta_pago: !a.esta_pago }),
      });
      const json = await res.json().catch(() => ({ error: "Error" }));
      if (!res.ok || json?.error)
        throw new Error(json?.error || "No se pudo actualizar el estado");
      // Optimistic update
      setArreglos((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, esta_pago: !a.esta_pago } : x))
      );
    } catch (err) {
      // opcional: set error toast si existiera
      console.error(err);
    }
  };

  const handleNavigateToCliente = () => {
    if (cliente) {
      // Guardar tipo de cliente en localStorage para que la página de detalle sepa qué endpoint usar
      localStorage.setItem("tipo_cliente", cliente.tipo_cliente);
      router.push(`${ROUTES.clientes}/${cliente.id}`);
    }
  };

  if (loading) return loadingScreen();

  if (error) {
    return (
      <div>
        <ScreenHeader title="Vehículos" breadcrumbs={["Detalle"]} />
        <div style={{ marginTop: 16, color: COLOR.ICON.DANGER }}>{error}</div>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div>
        <ScreenHeader title="Vehículos" breadcrumbs={["Detalle"]} />
        <div style={{ marginTop: 16 }}>Vehículo no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ArrowLeft
          size={20}
          color={COLOR.ICON.MUTED}
          onClick={() => router.back()}
          style={{ cursor: "pointer" }}
        />
        <ScreenHeader
          title={`${vehiculo.patente} - ${vehiculo.marca} ${vehiculo.modelo}`}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "start",
          gap: 8,
          marginTop: 16,
        }}
      >
        {/* Bloques superiores: Información del Vehículo y Propietario */}
        <div style={{ display: "flex", gap: 16 }}>
          <VehiculoInfoCard
            style={{ width: '70%' }}
            vehiculo={vehiculo}
            maxKilometraje={maxKilometraje}
            onEdit={() => setOpenEditVehiculo(true)}
          />

          {cliente && (
            <PropietarioCard 
              style={{ width: '30%' }}
              cliente={cliente} 
              onClick={handleNavigateToCliente}
            />
          )}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 0 }}>
          Ultimos arreglos
        </h3>

        <ArreglosList
          arreglos={arreglos}
          onCreateArreglo={handleOpenCreate}
          onTogglePago={togglePago}
          onEditArreglo={handleOpenEdit}
        />
      </div>
      {vehiculo && (
        <ArregloModal
          open={openModal}
          onClose={handleCloseModal}
          vehiculoId={vehiculo.id}
          initial={
            editArreglo
              ? {
                  id: editArreglo.id,
                  tipo: editArreglo.tipo,
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
        />
      )}
      {vehiculo && (
        <EditVehiculoModal
          open={openEditVehiculo}
          onClose={handleCloseEditVehiculo}
          vehiculo={vehiculo}
        />
      )}
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={{ maxHeight: "100%", minHeight: "0vh" }}>
      <Theme style={{ height: "100%", minHeight: "0vh" }}>
        <ScreenHeader title="Vehículos" breadcrumbs={["Detalle"]} />

        <div
          style={{
            flex: 1,
            marginTop: 16,
            gap: 16,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div
            style={{
              flex: 1,
              marginTop: 16,
              gap: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              width: "50%",
            }}
          >
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div
            style={{
              flex: 1,
              marginTop: 16,
              gap: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              width: "50%",
            }}
          >
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            marginTop: 32,
            gap: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Skeleton width="100%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="90%" height="16px" />
        </div>
      </Theme>
    </div>
  );
}
