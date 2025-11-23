"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { TipoCliente, Vehiculo } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import ClienteHeader from "../clientes/ClienteHeader";
import ContactInfoCard from "../clientes/ContactInfoCard";
import VehiculosAsociadosCard from "../clientes/VehiculosAsociadosCard";
import RepresentantesCard from "../clientes/RepresentantesCard";
import CreateRepresentanteModal from "../clientes/CreateRepresentanteModal";
import ClienteFormModal from "../clientes/ClienteFormModal";
import { useAppToast } from "@/app/hooks/useAppToast";
import type { UpdateEmpresaRequest } from "@/app/api/clientes/empresas/[id]/route";
import { useParams } from "next/navigation";
import { Empresa, empresaClient } from "@/clients/clientes/empresaClient";
import { useClientes } from "@/app/providers/ClientesProvider";


export default function EmpresaDetails() {
  const params = useParams();
  const clienteId = useMemo(() => params.id as string, [params]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [openVehiculo, setOpenVehiculo] = useState(false);
  const [openEditEmpresa, setOpenEditEmpresa] = useState(false);
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [openRepresentante, setOpenRepresentante] = useState(false);
  const toast = useAppToast();
  const { getEmpresaById } = useClientes();

  useEffect(() => {
    async function load() {
      const empresa = await getEmpresaById(clienteId);
      if (empresa) {
        setEmpresa(empresa);
        setVehiculos(empresa.vehiculos || []);
      }
    }
    if (clienteId) {
      load();
    }
  }, [clienteId, getEmpresaById]);


  React.useEffect(() => {
    const loadRepresentantes = async () => {
      if (!clienteId) return;
      try {
        const res = await fetch(`/api/clientes/empresas/${clienteId}/representantes`);
        const json = await res.json().catch(() => ({ data: [] }));
        setRepresentantes(json.data || []);
      } catch (e) {
        // silencioso
      }
    };
    loadRepresentantes();
  }, [clienteId]);

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
      const payload: UpdateEmpresaRequest = {
        nombre: values.nombre,
        cuit: values.cuit || '',
        telefono: values.telefono,
        email: values.email,
        direccion: values.direccion,
      };
      
      const { data, error } = await empresaClient.update(clienteId, payload);
      if (error || !data) {
        throw new Error(error || 'Error al actualizar empresa');
      }
      setEmpresa(data);
      toast.success('Empresa actualizada correctamente');
      setOpenEditEmpresa(false);
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
        <div style={{ width: '50%' }}>
          <ContactInfoCard
            email={empresa?.email ?? ''}
            telefono={empresa?.telefono}
            onEdit={() => setOpenEditEmpresa(true)}
          />
        </div>
        <div style={{ width: '50%' }}>
          <VehiculosAsociadosCard
            vehiculos={vehiculos}
            onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
          />
        </div>
      </div>
      <div style={{ width: '100%', marginTop: 16 }}>
        <RepresentantesCard
          representantes={representantes}
          onAddRepresentante={clienteId ? () => setOpenRepresentante(true) : undefined}
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
            setVehiculos((prev) => [
              { id: Math.random(), nombre_cliente: empresa?.nombre || '', patente: nuevo.patente, marca: nuevo.marca || '', modelo: nuevo.modelo || '', fecha_patente: nuevo.fecha_patente || '' },
              ...prev,
            ]);
          }
        }}
        clienteId={clienteId ?? ''}
      />
      <CreateRepresentanteModal
        open={openRepresentante}
        empresaId={clienteId ?? ''}
        onClose={(created) => {
          setOpenRepresentante(false);
          if (created) {
            setRepresentantes(prev => [
              { id: Math.random(), empresaId: clienteId, nombre: created.nombre, apellido: created.apellido, telefono: created.telefono },
              ...prev,
            ]);
            toast.success('Representante creado');
          }
        }}
      />
    </div>
  );
}
