import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Particular, TipoCliente, Vehiculo, ClienteResumenFinanciero } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import ClienteFormModal from "../clientes/ClienteFormModal";
import ClienteProfileCard from "../clientes/ClienteProfileCard";
import ClienteTabsSection from "../clientes/ClienteTabsSection";
import { useToast } from "@/app/providers/ToastProvider";
import type { UpdateParticularRequest } from "@/app/api/clientes/particulares/[id]/route";
import { useClientes } from "@/app/providers/ClientesProvider";
import { useParams } from "next/navigation";
import { clientesClient } from "@/clients/clientes/clientesClient";
import { logger } from "@/lib/logger";
import { useTenant } from "@/app/providers/TenantProvider";
import { Permission } from "@/lib/permissions";

export default function ParticularDetails() {
  const { hasPermission } = useTenant();
  const canViewFinanzas = hasPermission(Permission.ClientesFinanzasView);
  const [openVehiculo, setOpenVehiculo] = useState(false);
  const [openEditCliente, setOpenEditCliente] = useState(false);
  const params = useParams();
  const clienteId = useMemo(() => params.id as string, [params]);
  const [particular, setParticular] = useState<Particular | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [resumenFinanciero, setResumenFinanciero] = useState<ClienteResumenFinanciero | null>(null);
  const [loadingFinanzas, setLoadingFinanzas] = useState(false);

  const toast = useToast();
  const { getParticularById, updateParticular } = useClientes();

  const loadFinanzas = useCallback(async () => {
    if (!clienteId || !canViewFinanzas) return;
    setLoadingFinanzas(true);
    try {
      const res = await clientesClient.getResumenFinanciero(clienteId);
      if (res.data) setResumenFinanciero(res.data);
    } catch (e) {
      logger.error("Error cargando resumen financiero", e);
    } finally {
      setLoadingFinanzas(false);
    }
  }, [clienteId, canViewFinanzas]);

  useEffect(() => {
    async function load() {
      const particularData = await getParticularById(clienteId);
      if (particularData) {
        setParticular(particularData);
        setVehiculos(particularData.vehiculos || []);
      }
    }
    if (clienteId) {
      load();
      if (canViewFinanzas) {
        void loadFinanzas();
      }
    }
  }, [clienteId, getParticularById, loadFinanzas, canViewFinanzas]);

  const handleEditCliente = async (values: {
    nombre: string;
    apellido?: string;
    codigo_pais?: string;
    telefono: string;
    email: string;
    direccion: string;
    dni_cuil?: string | null;
    tipo_cliente: TipoCliente;
  }) => {
    if (!clienteId) return;

    try {
      const payload: UpdateParticularRequest = {
        nombre: values.nombre,
        apellido: values.apellido,
        codigo_pais: values.codigo_pais,
        telefono: values.telefono,
        email: values.email,
        direccion: values.direccion,
        dni_cuil: values.dni_cuil,
      };
      const data = await updateParticular(clienteId, payload);
      setParticular(data);

      toast.success("Cliente actualizado", `${data.nombre} ${data.apellido ?? ""} se actualizó correctamente.`);
      setOpenEditCliente(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(message);
      throw error;
    }
  };

  const nombreCompleto = particular?.apellido 
    ? `${particular.nombre} ${particular.apellido}`.trim()
    : particular?.nombre ?? "-";

  return (
    <div>
      {/* TARJETA PRINCIPAL DEL CLIENTE FIEL AL MOCKUP */}
      <ClienteProfileCard
        tipo={TipoCliente.PARTICULAR}
        nombre={nombreCompleto}
        direccion={particular?.direccion}
        email={particular?.email}
        telefono={particular?.telefono}
        codigo_pais={particular?.codigo_pais}
        dniCuil={particular?.dni_cuil}
        resumenFinanciero={resumenFinanciero}
        loadingFinanzas={loadingFinanzas}
        onEditCliente={() => setOpenEditCliente(true)}
      />

      <ClienteTabsSection
        clienteId={clienteId}
        vehiculos={vehiculos}
        onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
      />

      <ClienteFormModal
        open={openEditCliente}
        onClose={() => setOpenEditCliente(false)}
        onSubmit={handleEditCliente}
        mode="edit"
        initialValues={{
          nombre: particular?.nombre ?? "",
          apellido: particular?.apellido ?? "",
          codigo_pais: particular?.codigo_pais,
          telefono: particular?.telefono ?? "",
          email: particular?.email ?? "",
          direccion: particular?.direccion ?? "",
          dni_cuil: particular?.dni_cuil ?? null,
          tipo_cliente: TipoCliente.PARTICULAR,
        }}
      />

      <CreateVehiculoModal
        open={openVehiculo}
        onClose={(nuevo) => {
          setOpenVehiculo(false);
          if (nuevo) {
            setVehiculos((prev) => [
              ...prev,
              {
                id: nuevo.id,
                nombre_cliente: particular?.nombre || '',
                patente: nuevo.patente,
                marca: nuevo.marca || '',
                modelo: nuevo.modelo || '',
                fecha_patente: nuevo.fecha_patente || '',
                numero_chasis: nuevo.numero_chasis || '',
              },
            ]);
          }
        }}
        clienteId={clienteId ?? ''}
        tipoCliente="particular"
      />
    </div>
  );
}
