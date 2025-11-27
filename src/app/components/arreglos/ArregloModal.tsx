"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Autocomplete, { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { Vehiculo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { CreateArregloInput, UpdateArregloInput } from "@/clients/arreglosClient";

export type ArregloForm = {
  tipo: string;
  fecha: string;
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
  vehiculoId?: number | string;
  initial?: Partial<ArregloForm> & { id?: number };
};

export default function ArregloModal({ open, onClose, vehiculoId, initial }: Props) {
  const { vehiculos, fetchAll: fetchVehiculos } = useVehiculos();
  const { create, update } = useArreglos();
  const isEdit = !!initial?.id;
  const [tipo, setTipo] = useState(initial?.tipo ?? "");
  const [fecha, setFecha] = useState(initial?.fecha ?? "");
  const [km, setKm] = useState<string>(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
  const [precio, setPrecio] = useState<string>(initial?.precio_final != null ? String(initial.precio_final) : "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [estaPago, setEstaPago] = useState<boolean>(!!initial?.esta_pago);
  const [extraData, setExtraData] = useState(initial?.extra_data ?? "");
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>(vehiculoId ? String(vehiculoId) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehiculoId && open) {
      fetchVehiculos();
    }
  }, [open, vehiculoId, fetchVehiculos]);

  const vehiculoOptions: AutocompleteOption[] = useMemo(
    () =>
      vehiculos.map((v: Vehiculo) => ({
        value: String(v.id),
        label: `${v.patente} - ${v.marca} ${v.modelo}`,
        secondaryLabel: v.nombre_cliente,
      })),
    [vehiculos]
  );

  const opcionesDefault: AutocompleteOption[] = [
    { value: "Mecanica", label: "Mecanica" },
    { value: "Chapa y pintura", label: "Chapa y pintura" },
    { value: "Electricidad", label: "Electricidad" },
    { value: "Mantenimiento", label: "Mantenimiento" },
    { value: "Revision", label: "Revision" },
  ];

  useEffect(() => {
    if (!open) return;
    setTipo(initial?.tipo ?? "");
    setFecha(initial?.fecha ?? "");
    setKm(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
    setPrecio(initial?.precio_final != null ? String(initial.precio_final) : "");
    setObservaciones(initial?.observaciones ?? "");
    setDescripcion(initial?.descripcion ?? "");
    setEstaPago(!!initial?.esta_pago);
    setExtraData(initial?.extra_data ?? "");
    setSelectedVehiculoId(vehiculoId ? String(vehiculoId) : "");
  }, [open, initial, vehiculoId]);

  const isValid = useMemo(() => {
    const hasVehiculo = vehiculoId || selectedVehiculoId.trim().length > 0;
    return (
      hasVehiculo &&
      tipo.trim().length > 0 &&
      fecha.trim().length > 0 &&
      km.trim().length > 0 &&
      precio.trim().length > 0
    );
  }, [tipo, fecha, km, precio, vehiculoId, selectedVehiculoId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<UpdateArregloInput> = {
        tipo: tipo.trim(),
        fecha,
        kilometraje_leido: Number(km),
        precio_final: Number(precio),
        observaciones: observaciones?.trim() || undefined,
        descripcion: descripcion?.trim() || undefined,
        esta_pago: !!estaPago,
        extra_data: extraData?.trim() || undefined,
      };

      if (isEdit && initial?.id) {
        await update(initial.id, payload);
      } else {
        const finalVehiculoId = vehiculoId || selectedVehiculoId;
        await create({ vehiculo_id: finalVehiculoId!, ...payload } as CreateArregloInput);
      }

      onClose(true);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>{isEdit ? "Editar arreglo" : "Crear arreglo"}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "4px 0 12px" }}>
              {!vehiculoId && (
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Vehiculo <span style={{ color: "#d00" }}>*</span>
                    </label>
                    <Autocomplete
                      options={vehiculoOptions}
                      value={selectedVehiculoId}
                      onChange={setSelectedVehiculoId}
                      placeholder="Buscar vehiculo..."
                    />
                  </div>
                </div>
              )}
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Descripcion <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input style={styles.input} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripcion" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Tipo </label>
                  <Autocomplete options={opcionesDefault} value={tipo} onChange={setTipo} placeholder="Mecanica, Chapa y pintura..." allowCustomValue />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Fecha <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input type="date" style={styles.input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>¿Esta pago?</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={estaPago} onChange={(e) => setEstaPago(e.target.checked)} />
                    <span>Pagado</span>
                  </div>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Kilometraje </label>
                  <input
                    style={styles.input}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={km}
                    onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Precio final </label>
                  <input
                    style={styles.input}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                    placeholder="50000"
                  />
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
              <button type="button" style={styles.cancel} onClick={() => onClose()} disabled={submitting}>
                Cancelar
              </button>
              <Button
                text={
                  submitting
                    ? isEdit
                      ? "Guardando..."
                      : "Creando..."
                    : isEdit
                    ? "Guardar cambios"
                    : "Crear"
                }
                disabled={!isValid || submitting}
              />
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
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
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
