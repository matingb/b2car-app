"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Particular, TipoCliente, Vehiculo } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import ClienteHeader from "../clientes/ClienteHeader";
import ContactInfoCard from "../clientes/ContactInfoCard";
import VehiculosAsociadosCard from "../clientes/VehiculosAsociadosCard";
import ClienteFormModal from "../clientes/ClienteFormModal";
import { useAppToast } from "@/app/hooks/useAppToast";
import type { UpdateParticularRequest } from "@/app/api/clientes/particulares/[id]/route";
import { particularClient } from "@/clients/clientes/particularClient";
import { useParams } from "next/navigation";
import { useClientes } from "@/app/providers/ClientesProvider";


export default function ParticularDetails() {
    const [openVehiculo, setOpenVehiculo] = useState(false);
    const [openEditCliente, setOpenEditCliente] = useState(false);
    const params = useParams();
    const clienteId = useMemo(() => params.id as string, [params]);
    const [particular, setParticular] = useState<Particular | null>(null)
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    const toast = useAppToast();
    const { getParticularById } = useClientes();

    useEffect(() => {
        async function load() {
          const particular = await getParticularById(clienteId);
          if (particular) {
            setParticular(particular);
            setVehiculos(particular.vehiculos);
          }
        }
        if (clienteId) {
          load();
        }
      }, [clienteId, getParticularById]);

    const handleEditCliente = async (values: {
        nombre: string;
        apellido?: string;
        telefono: string;
        email: string;
        direccion: string;
        tipo_cliente: TipoCliente;
    }) => {
        if (!clienteId) return;

        try {
            const payload: UpdateParticularRequest = {
                nombre: values.nombre,
                apellido: values.apellido,
                telefono: values.telefono,
                email: values.email,
                direccion: values.direccion,
            };
            
            const { data, error } = await particularClient.update(clienteId, payload);

            if (error || !data) {
                throw new Error(error || 'Error al actualizar particular');
            }
            setParticular(data);

            toast.success('Cliente actualizado correctamente');
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
            <ClienteHeader
                nombre={nombreCompleto}
                showCreateButton={!!clienteId}
                onCreateClick={() => setOpenVehiculo(true)}
            />

            <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                <ContactInfoCard
                    email={particular?.email}
                    telefono={particular?.telefono}
                    onEdit={() => setOpenEditCliente(true)}
                />

                <VehiculosAsociadosCard 
                    vehiculos={vehiculos}
                    onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
                />
            </div>

            <ClienteFormModal
                open={openEditCliente}
                onClose={() => setOpenEditCliente(false)}
                onSubmit={handleEditCliente}
                mode="edit"
                initialValues={{
                    nombre: particular?.nombre ?? "",
                    apellido: particular?.apellido ?? "",
                    telefono: particular?.telefono ?? "",
                    email: particular?.email ?? "",
                    direccion: particular?.direccion ?? "",
                    tipo_cliente: TipoCliente.PARTICULAR,
                }}
            />

            <CreateVehiculoModal
                open={openVehiculo}
                onClose={(nuevo) => {
                    setOpenVehiculo(false);
                    if (nuevo) {
                        setVehiculos((prev) => [
                            // preprendemos para que se vea primero el recién creado
                            ...prev,
                            {
                                
                                id: Math.random(),
                                nombre_cliente: particular?.nombre || '',
                                patente: nuevo.patente,
                                marca: nuevo.marca || '',
                                modelo: nuevo.modelo || '',
                                fecha_patente: nuevo.fecha_patente || ''
                                
                            },

                        ]);
                    }
                }}
                clienteId={clienteId ?? ''}
            />
        </div>
    );
}
