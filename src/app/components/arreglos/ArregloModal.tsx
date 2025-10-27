"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { COLOR } from "@/theme/theme";

export type ArregloForm = {
    tipo: string;
    fecha: string; // YYYY-MM-DD
    kilometraje_leido: number | string;
    precio_final: number | string;
    observaciones?: string;
    descripcion?: string;
    esta_pago?: boolean;
    extra_data?: string;
};

type Props = {
    open: boolean;
    onClose: (updated?: boolean) => void;
    vehiculoId: number | string;
    initial?: Partial<ArregloForm> & { id?: number };
};

export default function ArregloModal({ open, onClose, vehiculoId, initial }: Props) {
    const isEdit = !!initial?.id;
    const [tipo, setTipo] = useState(initial?.tipo ?? "");
    const [fecha, setFecha] = useState(initial?.fecha ?? "");
    const [km, setKm] = useState<string>(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
    const [precio, setPrecio] = useState<string>(initial?.precio_final != null ? String(initial.precio_final) : "");
    const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
    const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
    const [estaPago, setEstaPago] = useState<boolean>(!!initial?.esta_pago);
    const [extraData, setExtraData] = useState(initial?.extra_data ?? "");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        // Sync when opening for edit
        setTipo(initial?.tipo ?? "");
        setFecha(initial?.fecha ?? "");
        setKm(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
        setPrecio(initial?.precio_final != null ? String(initial.precio_final) : "");
        setObservaciones(initial?.observaciones ?? "");
        setDescripcion(initial?.descripcion ?? "");
        setEstaPago(!!initial?.esta_pago);
        setExtraData(initial?.extra_data ?? "");
    }, [open, initial]);

    const isValid = useMemo(() => {
        return tipo.trim().length > 0 && fecha.trim().length > 0 && km.trim().length > 0 && precio.trim().length > 0;
    }, [tipo, fecha, km, precio]);

    // Calcular precio sin IVA para mostrar (solo informativo en el cliente)
    const clientIvaRate = (() => {
        const rate = process.env.NEXT_PUBLIC_IVA_RATE; // 0.21
        const percent = process.env.NEXT_PUBLIC_IVA_PERCENT; // 21
        if (rate && !Number.isNaN(Number(rate)) && Number(rate) >= 0 && Number(rate) < 1) return Number(rate);
        if (percent && !Number.isNaN(Number(percent)) && Number(percent) >= 0) return Number(percent) / 100;
        return 0.21;
    })();
    const precioSinIvaPreview = useMemo(() => {
        const pf = Number(precio);
        if (!pf || Number.isNaN(pf)) return '';
        return (pf / (1 + clientIvaRate)).toFixed(2);
    }, [precio, clientIvaRate]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        setSubmitting(true);
        setError(null);
        try {
            const payload: any = {
                tipo: tipo.trim(),
                fecha: fecha,
                kilometraje_leido: Number(km),
                precio_final: Number(precio),
                observaciones: observaciones?.trim() || undefined,
                descripcion: descripcion?.trim() || undefined,
                esta_pago: !!estaPago,
                extra_data: extraData?.trim() || undefined,
            };

            let res: Response;
            if (isEdit && initial?.id) {
                res = await fetch(`/api/arreglos/${initial.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/arreglos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehiculo_id: vehiculoId, ...payload })
                });
            }

            const json = await res.json().catch(() => ({ error: 'Error' }));
            if (!res.ok || json?.error) throw new Error(json?.error || 'No se pudo guardar el arreglo');

            onClose(true);
            // reset on create
            if (!isEdit) {
                setTipo("");
                setFecha("");
                setKm("");
                setPrecio("");
                setObservaciones("");
                setDescripcion("");
                setEstaPago(false);
                setExtraData("");
            }
        } catch (err: any) {
            setError(err?.message || 'Ocurrió un error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={styles.overlay} role="dialog" aria-modal="true">
            <div style={styles.modal}>
                <Card>
                    <div style={styles.headerRow}>
                        <h2 style={styles.title}>{isEdit ? 'Editar arreglo' : 'Crear arreglo'}</h2>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div style={{ padding: "4px 0 12px" }}>
                            <div style={styles.row}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Descripción <span style={{ color: '#d00' }}>*</span></label>
                                    <input style={styles.input} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" />
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>Tipo </label>
                                    <input style={styles.input} value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Mecánica, Chapa y pintura..." />
                                </div>
                            </div>

                            <div style={styles.row}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Fecha <span style={{ color: '#d00' }}>*</span></label>
                                    <input type="date" style={styles.input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>¿Está pago?</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={estaPago} onChange={(e) => setEstaPago(e.target.checked)} />
                                        <span>Pagado</span>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.row}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Kilometraje </label>
                                    <input style={styles.input} inputMode="numeric" pattern="[0-9]*" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>Precio final </label>
                                    <input style={styles.input} inputMode="numeric" pattern="[0-9]*" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))} placeholder="50000" />
                                </div>

                            </div>



                            <div style={styles.row}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Observaciones</label>
                                    <input style={styles.input} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones" />
                                </div>
                            </div>


                        </div>

                        {error && <div style={styles.error}>{error}</div>}

                        <div style={styles.footer}>
                            <button type="button" style={styles.cancel} onClick={() => onClose()} disabled={submitting}>Cancelar</button>
                            <Button text={submitting ? (isEdit ? 'Guardando...' : 'Creando...') : (isEdit ? 'Guardar cambios' : 'Crear')} disabled={!isValid || submitting} />
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed" as const,
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
    },
    modal: {
        width: "min(760px, 92vw)",
    },
    headerRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    title: { margin: 0 },
    row: { display: "flex", gap: 16, marginTop: 10 },
    field: { flex: 1 },
    label: { display: "block", fontSize: 13, marginBottom: 6, color: COLOR.TEXT.SECONDARY },
    input: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.INPUT.PRIMARY.BACKGROUND,
    },
    footer: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },
    cancel: {
        background: "transparent",
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        color: COLOR.TEXT.PRIMARY,
        padding: "0.5rem 1rem",
        borderRadius: 8,
        cursor: "pointer",
    },
    error: { color: "#b00020", fontSize: 13, marginTop: 6 },
} as const;
