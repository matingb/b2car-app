"use client";

import React, { useMemo, useState } from "react";
import { TipoCliente, Vehiculo } from "@/model/types";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";
import ClienteHeader from "../clientes/ClienteHeader";
import ContactInfoCard from "../clientes/ContactInfoCard";
import VehiculosAsociadosCard from "../clientes/VehiculosAsociadosCard";
import ClienteFormModal from "../clientes/ClienteFormModal";
import { useAppToast } from "@/app/hooks/useAppToast";

type Props = {
    cliente: { id?: number; nombre?: string; apellido?: string; email?: string; telefono?: string; direccion?: string } | null;
    vehiculos: Vehiculo[];
};

export default function ParticularDetails({ cliente, vehiculos }: Props) {
    const [openVehiculo, setOpenVehiculo] = useState(false);
    const [openEditCliente, setOpenEditCliente] = useState(false);
    const clienteId = useMemo(() => cliente?.id ?? undefined, [cliente]);
    const [vehiculosLocal, setVehiculosLocal] = useState<Vehiculo[]>(vehiculos ?? []);
    const toast = useAppToast();

    // Si cambian los props, sincronizamos el local una vez.
    React.useEffect(() => {
        setVehiculosLocal(vehiculos ?? []);
    }, [vehiculos]);

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
            const response = await fetch(`/api/clientes/particulares/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al actualizar cliente');
            }

            toast.success('Cliente actualizado correctamente');
            setOpenEditCliente(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(message);
            throw error;
        }
    };
    
    const nombreCompleto = cliente?.apellido 
        ? `${cliente.nombre} ${cliente.apellido}`.trim()
        : cliente?.nombre ?? "-";

    return (
        <div>
            <ClienteHeader
                nombre={nombreCompleto}
                showCreateButton={!!clienteId}
                onCreateClick={() => setOpenVehiculo(true)}
            />

            <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                <ContactInfoCard
                    email={cliente?.email}
                    telefono={cliente?.telefono}
                    onEdit={() => setOpenEditCliente(true)}
                />

                <VehiculosAsociadosCard 
                    vehiculos={vehiculosLocal}
                    onAddVehiculo={clienteId ? () => setOpenVehiculo(true) : undefined}
                />
            </div>

            <ClienteFormModal
                open={openEditCliente}
                onClose={() => setOpenEditCliente(false)}
                onSubmit={handleEditCliente}
                mode="edit"
                initialValues={{
                    nombre: cliente?.nombre ?? "",
                    apellido: cliente?.apellido ?? "",
                    telefono: cliente?.telefono ?? "",
                    email: cliente?.email ?? "",
                    direccion: cliente?.direccion ?? "",
                    tipo_cliente: TipoCliente.PARTICULAR,
                }}
            />

            <CreateVehiculoModal
                open={openVehiculo}
                onClose={(nuevo) => {
                    setOpenVehiculo(false);
                    if (nuevo) {
                        setVehiculosLocal((prev) => [
                            // preprendemos para que se vea primero el recién creado
                            ...prev,
                            {
                                
                                id: Math.random(),
                                nombre_cliente: cliente?.nombre || '',
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
