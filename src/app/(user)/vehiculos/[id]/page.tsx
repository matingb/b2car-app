"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import Avatar from "@/app/components/ui/Avatar";
import { Vehiculo, Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { Calendar, Car, Tag, Wrench, Gauge, Coins, FileText, CheckCircle2, XCircle, Pencil, PlusCircle, Plus } from "lucide-react";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import Button from "@/app/components/ui/Button";
import ArregloModal from "@/app/components/arreglos/ArregloModal";

type VehiculoResponse = {
    data: Vehiculo | null;
    arreglos?: Arreglo[];
    error?: string | null;
};

export default function VehiculoDetailsPage() {
    const params = useParams<{ id: string }>();
    const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
    const [arreglos, setArreglos] = useState<Arreglo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openModal, setOpenModal] = useState(false);
    const [editArreglo, setEditArreglo] = useState<Arreglo | null>(null);

    // Kilometraje más alto a partir de los arreglos
    const maxKilometraje = useMemo(() => {
        if (!arreglos || arreglos.length === 0) return undefined;
        return Math.max(...arreglos.map(a => Number(a.kilometraje_leido) || 0));
    }, [arreglos]);

    const reload = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/vehiculos/${params.id}`);
            const body: VehiculoResponse = await res.json();
            if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
            setVehiculo(body.data);
            setArreglos(body.arreglos || []);
        } catch (err: any) {
            setError(err?.message || "No se pudo cargar el vehículo");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        async function load() {
            await reload();
        }
        load();
        return () => {
            active = false;
        };
    }, [params.id]);

    const handleOpenCreate = () => { setEditArreglo(null); setOpenModal(true); };
    const handleOpenEdit = (a: Arreglo) => { setEditArreglo(a); setOpenModal(true); };
    const handleCloseModal = async (updated?: boolean) => {
        setOpenModal(false);
        setEditArreglo(null);
        if (updated) await reload();
    };

    const togglePago = async (a: Arreglo) => {
        try {
            const res = await fetch(`/api/arreglos/${a.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ esta_pago: !a.esta_pago })
            });
            const json = await res.json().catch(() => ({ error: 'Error' }));
            if (!res.ok || json?.error) throw new Error(json?.error || 'No se pudo actualizar el estado');
            // Optimistic update
            setArreglos(prev => prev.map(x => x.id === a.id ? { ...x, esta_pago: !a.esta_pago } : x));
        } catch (err) {
            // opcional: set error toast si existiera
            console.error(err);
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
            <ScreenHeader title="Vehículos" breadcrumbs={["Detalle"]} />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: 3 }}>{vehiculo.patente}</div>
                    <div style={{ color: "rgba(0,0,0,0.7)", fontSize: 18 }}>{`${vehiculo.marca} ${vehiculo.modelo}`}</div>
                </div>
                <Avatar nombre={vehiculo.nombre_cliente} size={50} />
                <div>
                    <div style={{ color: "rgba(0,0,0,0.7)", fontSize: 20, fontWeight: 700 }}>{vehiculo.nombre_cliente}</div>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                <Card>
                    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                        <IconLabel icon={<Tag size={16} color={COLOR.ACCENT.PRIMARY} />} label={`Marca: ${vehiculo.marca}`} />
                        <IconLabel icon={<Car size={16} color={COLOR.ACCENT.PRIMARY} />} label={`Modelo: ${vehiculo.modelo}`} />
                        <IconLabel icon={<Calendar size={16} color={COLOR.ACCENT.PRIMARY} />} label={`Año Patente: ${vehiculo.fecha_patente}`} />
                        {typeof maxKilometraje === 'number' && (
                            <IconLabel icon={<Gauge size={16} color={COLOR.ACCENT.PRIMARY} />} label={`Kilometraje: ${maxKilometraje}km`} />
                        )}
                    </div>
                </Card>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: 22 }}>Ultimos Arreglos</div>
                    {vehiculo && (
                        <Button icon={<Plus size={18} />} text="Crear arreglo" onClick={handleOpenCreate} />
                    )}
                </div>

                {arreglos.length === 0 ? (
                    <div style={{ color: "rgba(0,0,0,0.7)" }}>Este vehículo no tiene arreglos registrados.</div>
                ) : (

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {arreglos.map((a) => (
                            <Card key={a.id}>
                                <div key={a.id} style={styles.arregloRow}>
                                    <div style={styles.arregloHeader}>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                            {a.esta_pago ? (
                                                <IconLabel icon={<CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />} label="Pagado" />
                                            ) : (
                                                <IconLabel icon={<XCircle size={18} color={COLOR.ICON.DANGER} />} label="Pendiente" />
                                            )}
                                        </div>
                                        {a.tipo && a.tipo.trim() !== "" && (
                                            <IconLabel icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />} label={a.tipo} />
                                        )}
                                        
                                    </div>
                                    <div style={styles.arregloMeta}>
                                        <IconLabel
                                            icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
                                            label={
                                                a.fecha
                                                    ? new Date(a.fecha).toLocaleString("es-ES", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric"
                                                    })
                                                    : ""
                                            }
                                        />
                                        <IconLabel icon={<Coins size={18} color={COLOR.ACCENT.PRIMARY} />} label={`$${a.precio_final}`} />
                                        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                            <button aria-label="toggle pago" onClick={() => togglePago(a)} style={styles.iconBtn}>
                                                {a.esta_pago ? <XCircle size={18} color={COLOR.ICON.DANGER} /> : <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />}
                                            </button>
                                            <button aria-label="editar" onClick={() => handleOpenEdit(a)} style={styles.iconBtn}>
                                                <Pencil size={18}  />
                                            </button>
                                        </div>
                                    </div>
                                    {a.observaciones && (
                                        <div style={styles.infoLine}>
                                            <IconLabel icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />} label={a.observaciones} />
                                        </div>
                                    )}
                                    {a.descripcion && (
                                        <div style={styles.infoLine}>
                                            <IconLabel icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />} label={a.descripcion} />
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

            </div>
            {vehiculo && (
                <ArregloModal
                    open={openModal}
                    onClose={handleCloseModal}
                    vehiculoId={vehiculo.id}
                    initial={editArreglo ? {
                        id: editArreglo.id,
                        tipo: editArreglo.tipo,
                        fecha: editArreglo.fecha,
                        kilometraje_leido: editArreglo.kilometraje_leido,
                        precio_final: editArreglo.precio_final,
                        observaciones: editArreglo.observaciones,
                        descripcion: editArreglo.descripcion,
                        esta_pago: editArreglo.esta_pago,
                        extra_data: editArreglo.extra_data,
                    } : undefined}
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

const styles = {
    arregloRow: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "0px 0",
    },
    arregloTitle: {
        fontWeight: 600,
    },
    arregloMeta: {
        display: "flex",
        gap: 16,
        color: "rgba(0,0,0,0.8)",
        fontSize: 16,
        flexWrap: 'wrap',
    },
    arregloDesc: {
        color: "rgba(0,0,0,0.8)",
    },
    arregloHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'start',
        fontSize: 16,
        marginBottom: 4,
        gap: 16,
    },
    infoLine: {
        fontSize: 16,
        color: 'rgba(0,0,0,0.8)',
    },
    iconBtn: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 4,
        borderRadius: 6,
    },
} as const;

