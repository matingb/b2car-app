"use client";

import React, { useMemo, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { TipoCliente, Vehiculo } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import ClienteHeader from "../clientes/ClienteHeader";
import ContactInfoCard from "../clientes/ContactInfoCard";
import VehiculosAsociadosCard from "../clientes/VehiculosAsociadosCard";
import ClienteFormModal from "../clientes/ClienteFormModal";
import { useAppToast } from "@/app/hooks/useAppToast";

// Diseño adaptado para empresas
// Muestra nombre de la empresa y datos de contacto; lista de vehículos igual que particulares

type Props = {
  empresa: {
    id?: number;
    nombre?: string;
    cuit?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
  } | null;
  vehiculos: Vehiculo[];
};

export default function EmpresaDetails({ empresa, vehiculos }: Props) {
  const [openVehiculo, setOpenVehiculo] = useState(false);
  const [openEditEmpresa, setOpenEditEmpresa] = useState(false);
  const clienteId = useMemo(() => empresa?.id ?? undefined, [empresa]);
  const [vehiculosLocal, setVehiculosLocal] = useState<Vehiculo[]>(vehiculos ?? []);
  const toast = useAppToast();
  
  React.useEffect(() => {
    setVehiculosLocal(vehiculos ?? []);
  }, [vehiculos]);

  const handleEditEmpresa = async (values: {
    nombre: string;
    cuit?: string;
    telefono: string;
    email: string;
    direccion: string;
    tipo_cliente: TipoCliente;
  }) => {
    if (!clienteId) return;

    try {
      const response = await fetch(`/api/clientes/empresas/${clienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar empresa');
      }

      toast.success('Empresa actualizada correctamente');
      setOpenEditEmpresa(false);
      // Forzar recarga de la página para actualizar los datos
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(message);
      throw error;
    }
  };

  return (
    <div>
      <ClienteHeader
        nombre={empresa?.nombre ?? "-"}
        icon={<Building2 size={22} color={COLOR.ACCENT.PRIMARY} />}
        subtitle={
          empresa?.direccion ? (
            <>
              <MapPin size={16} /> {empresa.direccion}
            </>
          ) : undefined
        }
        showCreateButton={!!clienteId}
        onCreateClick={() => setOpenVehiculo(true)}
      />

      <div style={{ display: "flex", gap: 16 }}>
        <ContactInfoCard
          email={empresa?.email}
          telefono={empresa?.telefono}
          onEdit={() => setOpenEditEmpresa(true)}
        />

        <VehiculosAsociadosCard 
          vehiculos={vehiculosLocal}
          onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
        />
      </div>

      <ClienteFormModal
        open={openEditEmpresa}
        onClose={() => setOpenEditEmpresa(false)}
        onSubmit={handleEditEmpresa}
        mode="edit"
        initialValues={{
          nombre: empresa?.nombre ?? "",
          cuit: empresa?.cuit ?? "",
          telefono: empresa?.telefono ?? "",
          email: empresa?.email ?? "",
          direccion: empresa?.direccion ?? "",
          tipo_cliente: TipoCliente.EMPRESA,
        }}
      />

      <CreateVehiculoModal
        open={openVehiculo}
        onClose={(nuevo) => {
          setOpenVehiculo(false);
          if (nuevo) {
            setVehiculosLocal((prev) => [
              { id: Math.random(), nombre_cliente: empresa?.nombre || '', patente: nuevo.patente, marca: nuevo.marca || '', modelo: nuevo.modelo || '', fecha_patente: nuevo.fecha_patente || '' },
              ...prev,
            ]);
          }
        }}
        clienteId={clienteId ?? ''}
      />
    </div>
  );
}
