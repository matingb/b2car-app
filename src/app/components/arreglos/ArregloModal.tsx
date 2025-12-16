"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete, { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Modal from "@/app/components/ui/Modal";
import { Arreglo, Vehiculo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { CreateArregloInput, UpdateArregloInput } from "@/clients/arreglosClient";
import { isValidDate, toDateInputFormat } from "@/utils/fechas";
import { formatPatenteConMarcaYModelo } from "@/utils/vehiculos";

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
  vehiculoId?: number | string;
  initial?: Partial<ArregloForm> & { id?: number };
  onClose: (updated?: boolean) => void;
  onSubmitSuccess?: (arreglo: Arreglo) => void;
};

export default function ArregloModal({ open, onClose, vehiculoId, initial, onSubmitSuccess }: Props) {
  const { vehiculos, fetchAll: fetchVehiculos } = useVehiculos();
  const { create, update } = useArreglos();

  const isEdit = !!initial?.id;
  const [tipo, setTipo] = useState(initial?.tipo ?? "");
  const [fecha, setFecha] = useState(toDateInputFormat(initial?.fecha));
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
      vehiculos.map((v: Vehiculo) => {
        return {
          value: String(v.id),
          label: formatPatenteConMarcaYModelo(v),
          secondaryLabel: v.nombre_cliente,
        };
      }),
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
    setFecha(toDateInputFormat(initial?.fecha));
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
      isValidDate(fecha)
      && descripcion.trim().length > 0
    );
  }, [fecha, descripcion, vehiculoId, selectedVehiculoId]);

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

      let response: Arreglo | null = null;
      
      if (isEdit && initial?.id) {
        response = await update(initial.id, payload);
        if (!response) return;
      } else {
        const finalVehiculoId = vehiculoId || selectedVehiculoId;
        response = await create({ vehiculo_id: finalVehiculoId!, ...payload } as CreateArregloInput);
      }

      if (response) {
        onSubmitSuccess?.(response);
      }

      onClose();
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
    <Modal
      open={open}
      title={isEdit ? "Editar arreglo" : "Crear arreglo"}
      onClose={() => onClose()}
      onSubmit={handleSubmit}
      submitText={isEdit ? "Guardar cambios" : "Crear"}
      submitting={submitting}
      disabledSubmit={!isValid}
    >
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
            <label style={styles.label}>Tipo</label>
            <Autocomplete
              options={opcionesDefault}
              value={tipo}
              onChange={setTipo}
              placeholder="Mecanica, Chapa y pintura..."
              allowCustomValue
            />
          </div>
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
            <label style={styles.label}>
              Descripcion <span style={{ color: "#d00" }}>*</span>
            </label>
            <textarea
              style={styles.input}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripcion"
              rows={3}
            />
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
            <textarea
              style={styles.input}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones"
              rows={3}
            />
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </Modal>
  );
}

const styles = {
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
  error: { color: "#b00020", fontSize: 13, marginTop: 6 },
} as const;
