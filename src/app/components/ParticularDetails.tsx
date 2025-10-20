"use client";

import React, { useMemo, useState } from "react";
import Avatar from "@/app/components/Avatar";
import Card from "@/app/components/Card";
import IconLabel from "@/app/components/IconLabel";
import { Divider } from "@mui/material";
import { Mail, Phone, PlusIcon } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { Vehiculo } from "@/model/types";
import Button from "./Button";
import CreateVehiculoModal from "./CreateVehiculoModal";

type Props = {
    cliente: { id?: number; nombre?: string; email?: string; telefono?: string } | null;
    vehiculos: Vehiculo[];
};

export default function ParticularDetails({ cliente, vehiculos }: Props) {
    const [openVehiculo, setOpenVehiculo] = useState(false);
    const clienteId = useMemo(() => cliente?.id ?? undefined, [cliente]);
    const [vehiculosLocal, setVehiculosLocal] = useState<Vehiculo[]>(vehiculos ?? []);

    // Si cambian los props, sincronizamos el local una vez.
    React.useEffect(() => {
        setVehiculosLocal(vehiculos ?? []);
    }, [vehiculos]);
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 16,
                }}
            >
                <Avatar nombre={cliente?.nombre ?? ""} size={60} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ margin: 0 }}>{cliente?.nombre ?? "-"}</h1>
                    {clienteId && (
                        <Button icon={<PlusIcon size={20} />} text="Crear vehículo" onClick={() => setOpenVehiculo(true)} />
                    )}
                </div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
                <Card style={styles.contentPanel}>
                    <h2>Datos de contacto</h2>
                    <Divider />

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            alignContent: "center",
                            padding: "4px 8px",
                        }}
                    >
                        <IconLabel
                            icon={<Mail size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
                            label={cliente?.email ?? "-"}
                        />
                        <IconLabel
                            icon={<Phone size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
                            label={cliente?.telefono ?? "-"}
                        />
                    </div>
                </Card>

                <Card style={styles.contentPanel}>
                    <h2>Vehículos asociados</h2>
                    <Divider />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {vehiculosLocal && vehiculosLocal.length > 0 ? (
                            vehiculosLocal.map((vehiculo: Vehiculo) => (
                                <span
                                    key={vehiculo.id ?? vehiculo.patente ?? Math.random()}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "4px 8px",
                                    }}
                                >
                                    <strong>{vehiculo.patente ?? "-"}</strong>-<span>
                                        {vehiculo.marca ?? "-"} {vehiculo.modelo ?? "-"}
                                    </span>
                                </span>
                            ))
                        ) : (
                            <span>No hay vehículos asociados</span>
                        )}
                    </div>
                </Card>
            </div>

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

const styles = {
    contentPanel: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "50%",
    },
} as const;
