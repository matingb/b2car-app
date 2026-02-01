"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Autocomplete, { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Modal from "@/app/components/ui/Modal";
import { Arreglo, Vehiculo } from "@/model/types";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { CreateArregloInput, UpdateArregloInput } from "@/clients/arreglosClient";
import { isValidDate, toDateInputFormat } from "@/lib/fechas";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { formatArs } from "@/lib/format";
import { css } from "@emotion/react";
import { useTenant } from "@/app/providers/TenantProvider";
import ServicioLineasEditableSection, {
  type ServicioLinea,
} from "@/app/components/arreglos/lineas/ServicioLineasEditableSection";
import RepuestoLineasEditableSection, {
  type RepuestoLinea,
} from "@/app/components/arreglos/lineas/RepuestoLineasEditableSection";

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
  initial?: Partial<ArregloForm> & { id?: string };
  onClose: (updated?: boolean) => void;
  onSubmitSuccess?: (arreglo: Arreglo) => void;
};

export default function ArregloModal({ open, onClose, vehiculoId, initial, onSubmitSuccess }: Props) {
  const { vehiculos, fetchAll: fetchVehiculos } = useVehiculos();
  const { create, update } = useArreglos();
  const { tallerSeleccionadoId } = useTenant();

  const isEdit = !!initial?.id;
  const [tipo, setTipo] = useState(initial?.tipo ?? "");
  const [fecha, setFecha] = useState(toDateInputFormat(initial?.fecha));
  const [km, setKm] = useState<string>(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [estaPago, setEstaPago] = useState<boolean>(!!initial?.esta_pago);
  const [extraData, setExtraData] = useState(initial?.extra_data ?? "");
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>(vehiculoId ? String(vehiculoId) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviciosDraft, setServiciosDraft] = useState<ServicioLinea[]>([]);
  const [repuestosDraft, setRepuestosDraft] = useState<RepuestoLinea[]>([]);
  const nextServicioSeq = useRef(0);
  const nextRepuestoSeq = useRef(0);

  const newServicioId = () => {
    nextServicioSeq.current += 1;
    return `svc-${nextServicioSeq.current}`;
  };

  const newRepuestoId = () => {
    nextRepuestoSeq.current += 1;
    return `rep-${nextRepuestoSeq.current}`;
  };

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
    setObservaciones(initial?.observaciones ?? "");
    setEstaPago(!!initial?.esta_pago);
    setExtraData(initial?.extra_data ?? "");
    setSelectedVehiculoId(vehiculoId ? String(vehiculoId) : "");

    if (!isEdit) {
      setServiciosDraft([]);
      setRepuestosDraft([]);
      nextServicioSeq.current = 0;
      nextRepuestoSeq.current = 0;
    }
  }, [open, initial, vehiculoId, isEdit]);

  const isValid = useMemo(() => {
    const hasVehiculo = vehiculoId || selectedVehiculoId.trim().length > 0;
    return (
      hasVehiculo &&
      isValidDate(fecha)
    );
  }, [fecha, vehiculoId, selectedVehiculoId]);

  if (!open) return null;

  const subtotalServicios = serviciosDraft.reduce(
    (acc, s) => acc + (Number(s.cantidad) || 0) * (Number(s.valor) || 0),
    0
  );
  const subtotalRepuestos = repuestosDraft.reduce(
    (acc, r) => acc + (Number(r.cantidad) || 0) * (Number(r.monto_unitario) || 0),
    0
  );
  const totalCalculado = subtotalServicios + subtotalRepuestos;
  const totalCalculadoLabel = formatArs(totalCalculado, {
    maxDecimals: 0,
    minDecimals: 0,
  });

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
        observaciones: observaciones?.trim() || undefined,
        esta_pago: !!estaPago,
        extra_data: extraData?.trim() || undefined,
      };

      let response: Arreglo | null = null;
      
      if (isEdit && initial?.id) {
        response = await update(initial.id, payload);
        if (!response) return;
      } else {
        if (!tallerSeleccionadoId) {
          throw new Error("Ocurrió un error al crear el arreglo");
        }
        const finalVehiculoId = vehiculoId || selectedVehiculoId;
        const precioFinalCalculado = Math.round(Number(totalCalculado) || 0);
        response = await create({
          vehiculo_id: finalVehiculoId!,
          taller_id: tallerSeleccionadoId,
          tipo: payload.tipo ?? "",
          fecha: fecha,
          kilometraje_leido: Number(km) || 0,
          precio_final: precioFinalCalculado,
          observaciones: payload.observaciones,
          esta_pago: payload.esta_pago,
          extra_data: payload.extra_data,
          detalles: serviciosDraft.map((s) => ({
            descripcion: String(s.descripcion ?? "").trim(),
            cantidad: Number(s.cantidad) || 0,
            valor: Number(s.valor) || 0,
          })),
          repuestos: repuestosDraft.map((r) => ({
            stock_id: String(r.stock_id ?? "").trim(),
            cantidad: Number(r.cantidad) || 0,
            monto_unitario: Number(r.monto_unitario) || 0,
          })),
        } as CreateArregloInput);
      }

      if (response) {
        onSubmitSuccess?.(response);
      }

      onClose();
      if (!isEdit) {
        setTipo("");
        setFecha("");
        setKm("");
        setObservaciones("");
        setEstaPago(false);
        setExtraData("");
        setServiciosDraft([]);
        setRepuestosDraft([]);
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
      modalStyle={{
        width: "min(860px, 96vw)",
        height: "min(820px, 90dvh)",
        overflow: "auto",
      }}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          {!vehiculoId && (
            <div style={styles.field}>
              <label style={styles.label}>
                Vehiculo <span aria-hidden="true" style={styles.required}>*</span>
              </label>
              <Autocomplete
                options={vehiculoOptions}
                value={selectedVehiculoId}
                onChange={setSelectedVehiculoId}
                placeholder="Buscar vehiculo..."
              />
            </div>
          )}
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
        </div>

        <div css={styles.kmRow}>
          <div css={styles.kmFechaField}>
            <label style={styles.label}>Kilometraje</label>
            <input
              style={styles.input}
              inputMode="numeric"
              pattern="[0-9]*"
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          </div>
          <div css={styles.kmFechaField}>
            <label style={styles.label}>
              Fecha <span aria-hidden="true" style={styles.required}>*</span>
            </label>
            <input type="date" style={styles.input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div css={styles.pagoField}>
            <label style={styles.label}>¿Esta pago?</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44 }}>
              <input type="checkbox" checked={estaPago} onChange={(e) => setEstaPago(e.target.checked)} />
              <span>Pagado</span>
            </div>
          </div>
        </div>

        {!isEdit ? (
          <div style={{ marginTop: 6 }}>
            <ServicioLineasEditableSection
              items={serviciosDraft}
              onAdd={(input) => {
                setServiciosDraft((prev) => [
                  ...prev,
                  {
                    id: newServicioId(),
                    descripcion: input.descripcion,
                    cantidad: input.cantidad,
                    valor: input.valor,
                  },
                ]);
              }}
              onUpdate={(id, patch) => {
                setServiciosDraft((prev) =>
                  prev.map((s) =>
                    s.id === id
                      ? {
                          ...s,
                          descripcion: patch.descripcion,
                          cantidad: patch.cantidad,
                          valor: patch.valor,
                        }
                      : s
                  )
                );
              }}
              onDelete={(id) => {
                setServiciosDraft((prev) => prev.filter((s) => s.id !== id));
              }}
              disabled={submitting}
            />

            <div
              style={{
                height: 1,
                background: COLOR.BORDER.SUBTLE,
                margin: "18px 0",
              }}
            />

            <RepuestoLineasEditableSection
              tallerId={tallerSeleccionadoId ?? null}
              items={repuestosDraft}
              onUpsert={(input) => {
                setRepuestosDraft((prev) => {
                  const idx = prev.findIndex((r) => r.stock_id === input.stock_id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
                      cantidad: input.cantidad,
                      monto_unitario: input.monto_unitario,
                    };
                    return next;
                  }
                  return [
                    ...prev,
                    {
                      id: newRepuestoId(),
                      stock_id: input.stock_id,
                      cantidad: input.cantidad,
                      monto_unitario: input.monto_unitario,
                      producto: null,
                    },
                  ];
                });
              }}
              onDelete={(id) => {
                setRepuestosDraft((prev) => prev.filter((r) => r.id !== id));
              }}
              disabled={submitting}
            />

            <div style={stylesModal.totalRow}>
              <span style={stylesModal.totalLabel}>Total calculado</span>
              <span style={stylesModal.totalValue}>{totalCalculadoLabel}</span>
            </div>
          </div>
        ) : null}

        <div css={styles.row}>
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
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  kmRow: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      flexWrap: "wrap",
      gap: 8,
    },
  }),
  kmFechaField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 calc(50% - 4px)",
      minWidth: 140,
    },
  }),
  pagoField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 100%",
    },
  }),
  field: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    boxSizing: "border-box" as const,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  error: { color: "#b00020", fontSize: 13, marginTop: 6 },
} as const;

const stylesModal = {
  totalRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 8,
  },
  totalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
  },
  totalValue: {
    fontWeight: 700,
    fontSize: 18,
    color: COLOR.TEXT.PRIMARY,
  },
} as const;
