"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { TipoCliente, Vehiculo, Representante, ClienteResumenFinanciero } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import VehiculosAsociadosCard from "../clientes/VehiculosAsociadosCard";
import CreateRepresentanteModal from "../clientes/CreateRepresentanteModal";
import ClienteFormModal from "../clientes/ClienteFormModal";
import ClienteProfileCard from "../clientes/ClienteProfileCard";
import ClienteTabsNav, { type ClienteTabKey } from "../clientes/ClienteTabsNav";
import ClienteArreglosTab from "../clientes/ClienteArreglosTab";
import ClienteCuentaCorrienteTab from "../clientes/ClienteCuentaCorrienteTab";
import { useToast } from "@/app/providers/ToastProvider";
import type { UpdateEmpresaRequest } from "@/app/api/clientes/empresas/[id]/route";
import { useParams } from "next/navigation";
import { Empresa } from "@/clients/clientes/empresaClient";
import { useClientes } from "@/app/providers/ClientesProvider";
import { logger } from "@/lib/logger";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { clientesClient } from "@/clients/clientes/clientesClient";

export default function EmpresaDetails() {
  const params = useParams();
  const clienteId = useMemo(() => params.id as string, [params]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [openVehiculo, setOpenVehiculo] = useState(false);
  const [openEditEmpresa, setOpenEditEmpresa] = useState(false);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [openRepresentante, setOpenRepresentante] = useState(false);
  const [activeTab, setActiveTab] = useState<ClienteTabKey>("vehiculos");
  const [resumenFinanciero, setResumenFinanciero] = useState<ClienteResumenFinanciero | null>(null);
  const [loadingFinanzas, setLoadingFinanzas] = useState(false);

  const toast = useToast();
  const { getEmpresaById, listRepresentantes, createRepresentante, deleteRepresentante, updateEmpresa } = useClientes();
  const { confirm } = useModalMessage();

  const loadFinanzas = useCallback(async () => {
    if (!clienteId) return;
    setLoadingFinanzas(true);
    try {
      const res = await clientesClient.getResumenFinanciero(clienteId);
      if (res.data) setResumenFinanciero(res.data);
    } catch (e) {
      logger.error("Error cargando resumen financiero", e);
    } finally {
      setLoadingFinanzas(false);
    }
  }, [clienteId]);

  useEffect(() => {
    async function load() {
      const empresaData = await getEmpresaById(clienteId);
      if (empresaData) {
        setEmpresa(empresaData);
        setVehiculos(empresaData.vehiculos || []);
      }
    }
    if (clienteId) {
      load();
      void loadFinanzas();
    }
  }, [clienteId, getEmpresaById, loadFinanzas]);

  useEffect(() => {
    const loadRepresentantes = async () => {
      if (!clienteId) return;
      try {
        const reps = await listRepresentantes(clienteId);
        setRepresentantes(reps);
      } catch (e) {
        logger.error("No se pudieron cargar los representantes", e);
      }
    };
    loadRepresentantes();
  }, [clienteId, listRepresentantes]);

  const handleEditEmpresa = async (values: {
    nombre: string;
    cuit?: string;
    codigo_pais?: string;
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
        codigo_pais: values.codigo_pais,
        telefono: values.telefono,
        email: values.email,
        direccion: values.direccion,
      };

      const data = await updateEmpresa(clienteId, payload);
      setEmpresa(data);
      toast.success("Empresa actualizada", `${data.nombre} se actualizó correctamente.`);
      setOpenEditEmpresa(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(message);
      throw error;
    }
  };

  const handleDeleteRepresentante = async (representanteId: string) => {
    if (!clienteId) return;
    const ok = await confirm({
      title: "Eliminar representante",
      message: "¿Estás seguro de que deseas eliminar este representante?",
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    try {
      await deleteRepresentante(clienteId, representanteId);
      setRepresentantes((prev) => prev.filter((r) => r.id !== representanteId));
      toast.success("Representante eliminado", "El representante se eliminó correctamente.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo eliminar el representante";
      toast.error(msg);
    }
  };

  return (
    <div>
      {/* TARJETA PRINCIPAL DEL CLIENTE FIEL AL MOCKUP */}
      <ClienteProfileCard
        tipo={TipoCliente.EMPRESA}
        nombre={empresa?.nombre ?? "-"}
        direccion={empresa?.direccion}
        email={empresa?.email}
        telefono={empresa?.telefono}
        codigo_pais={empresa?.codigo_pais}
        cuit={empresa?.cuit}
        resumenFinanciero={resumenFinanciero}
        loadingFinanzas={loadingFinanzas}
        onEditCliente={() => setOpenEditEmpresa(true)}
        representantes={representantes}
        onAddRepresentante={() => setOpenRepresentante(true)}
        onDeleteRepresentante={handleDeleteRepresentante}
      />

      {/* TABS DE NAVEGACIÓN */}
      <ClienteTabsNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        vehiculosCount={vehiculos.length}
      />

      {/* CONTENIDO SEGÚN TAB ACTIVA */}
      {activeTab === "vehiculos" && (
        <VehiculosAsociadosCard
          vehiculos={vehiculos}
          onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
        />
      )}

      {activeTab === "arreglos" && (
        <ClienteArreglosTab
          clienteId={clienteId}
        />
      )}

      {activeTab === "cuenta_corriente" && (
        <ClienteCuentaCorrienteTab
          clienteId={clienteId}
        />
      )}

      <ClienteFormModal
        open={openEditEmpresa}
        onClose={() => setOpenEditEmpresa(false)}
        onSubmit={handleEditEmpresa}
        mode="edit"
        initialValues={{
          nombre: empresa?.nombre ?? "",
          cuit: empresa?.cuit ?? "",
          codigo_pais: empresa?.codigo_pais,
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
              {
                id: nuevo.id,
                nombre_cliente: empresa?.nombre || '',
                patente: nuevo.patente,
                marca: nuevo.marca || '',
                modelo: nuevo.modelo || '',
                fecha_patente: nuevo.fecha_patente || '',
                nro_interno: nuevo.nro_interno || '',
                numero_chasis: nuevo.numero_chasis || '',
              },
              ...prev,
            ]);
          }
        }}
        clienteId={clienteId ?? ''}
        tipoCliente="empresa"
      />
      <CreateRepresentanteModal
        open={openRepresentante}
        onClose={async (created) => {
          setOpenRepresentante(false);
          if (created) {
            try {
              const nuevo = await createRepresentante(clienteId, created);
              setRepresentantes(prev => [nuevo, ...prev]);
              toast.success("Representante creado", "El representante se agregó correctamente.");
            } catch (err) {
              console.log(err)
              const msg = err instanceof Error ? err.message : "No se pudo crear el representante";
              toast.error(msg);
            }
          }
        }}
      />
    </div>
  );
}
