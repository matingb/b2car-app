"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Modal from "@/app/components/ui/Modal";
import { Arreglo, Vehiculo } from "@/model/types";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { CreateArregloInput, UpdateArregloInput } from "@/clients/arreglosClient";
import { toDateInputFormat } from "@/lib/fechas";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { buildArregloWhatsappMessage } from "@/lib/whatsapp";
import { useTenant } from "@/app/providers/TenantProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";
import { useToast } from "@/app/providers/ToastProvider";
import { ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types";
import ArregloFormFields, {
  type ArregloForm,
  type ArregloFormFieldsInternal,
  type ArregloFormFieldsValues,
} from "@/app/components/arreglos/ArregloFormFields";

type Props = {
  open: boolean;
  vehiculoId?: number | string;
  initial?: Partial<ArregloForm> & { id?: string };
  onClose: (updated?: boolean) => void;
  onSubmitSuccess?: (arreglo: Arreglo) => void;
};

export default function ArregloModal({ open, onClose, vehiculoId, initial, onSubmitSuccess }: Props) {
  const { vehiculos, fetchAll: fetchVehiculos, fetchCliente } = useVehiculos();
  const { create, update, fetchById } = useArreglos();
  const { tallerSeleccionadoId } = useTenant();
  const { confirm } = useModalMessage();
  const { success, error: toastError } = useToast();
  const { share } = useWhatsAppMessage();

  const createEmptyInternal = (): ArregloFormFieldsInternal => ({
    serviciosDraft: [],
    repuestosDraft: [],
    subtotalServicios: 0,
    subtotalRepuestos: 0,
    totalCalculado: 0,
    totalCalculadoLabel: "0",
  });

  const isEdit = !!initial?.id;
  const [tipo, setTipo] = useState(initial?.tipo ?? "");
  const [estado, setEstado] = useState<EstadoArreglo>(initial?.estado ?? "SIN_INICIAR");
  const [fecha, setFecha] = useState(toDateInputFormat(initial?.fecha));
  const [km, setKm] = useState<string>(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [estaPago, setEstaPago] = useState<boolean>(!!initial?.esta_pago);
  const [extraData, setExtraData] = useState(initial?.extra_data ?? "");
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>(vehiculoId ? String(vehiculoId) : "");
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState<ArregloFormFieldsInternal>(() =>
    createEmptyInternal()
  );

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

  useEffect(() => {
    if (!open) return;
    setTipo(initial?.tipo ?? "");
    setEstado(initial?.estado ?? "SIN_INICIAR");
    setFecha(toDateInputFormat(initial?.fecha));
    setKm(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
    setObservaciones(initial?.observaciones ?? "");
    setEstaPago(!!initial?.esta_pago);
    setExtraData(initial?.extra_data ?? "");
    setSelectedVehiculoId(vehiculoId ? String(vehiculoId) : "");
    setIsValid(false);

    if (!isEdit) {
      setInternal(createEmptyInternal());
    }
  }, [open, initial, vehiculoId, isEdit]);

  if (!open) return null;

  const fieldValues: ArregloFormFieldsValues = {
    tipo,
    estado,
    fecha,
    km,
    observaciones,
    estaPago,
    extraData,
    selectedVehiculoId,
  };

  const handleFieldsChange = (patch: Partial<ArregloFormFieldsValues>) => {
    const setters: Record<keyof ArregloFormFieldsValues, (value: unknown) => void> = {
      tipo: (value) => setTipo(typeof value === "string" ? value : ""),
      estado: (value) => {
        const next = String(value ?? "").trim().toUpperCase();
        if ((ESTADOS_ARREGLO as string[]).includes(next)) {
          setEstado(next as EstadoArreglo);
        }
      },
      fecha: (value) => setFecha(typeof value === "string" ? value : ""),
      km: (value) => setKm(typeof value === "string" ? value : ""),
      observaciones: (value) =>
        setObservaciones(typeof value === "string" ? value : ""),
      estaPago: (value) => setEstaPago(Boolean(value)),
      extraData: (value) => setExtraData(typeof value === "string" ? value : ""),
      selectedVehiculoId: (value) =>
        setSelectedVehiculoId(typeof value === "string" ? value : ""),
    };

    (Object.keys(patch) as (keyof ArregloFormFieldsValues)[]).forEach((key) => {
      setters[key](patch[key]);
    });
  };

  const handleShareArreglo = async (arregloId: string | number) => {
    try {
      const detalle = await fetchById(arregloId);
      if (!detalle?.arreglo?.vehiculo?.id) {
        toastError("Error", "No se pudo identificar el vehículo");
        return;
      }

      const tenantName = localStorage.getItem("tenant_name") || undefined;
      const mensaje = buildArregloWhatsappMessage(detalle, tenantName);
      if (!mensaje) {
        toastError("Error", "No se pudo generar el mensaje");
        return;
      }

      const cliente = await fetchCliente(String(detalle.arreglo.vehiculo.id));
      await share(mensaje, cliente?.telefono);
    } catch (err: unknown) {
      toastError("Error", err instanceof Error ? err.message : "No se pudo compartir el arreglo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: Partial<UpdateArregloInput> = {
        tipo: tipo.trim(),
        estado,
        fecha,
        kilometraje_leido: Number(km),
        observaciones: observaciones?.trim() || undefined,
        esta_pago: !!estaPago,
        extra_data: extraData || undefined,
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
        const precioFinalCalculado = Math.round(Number(internal.totalCalculado) || 0);
        response = await create({
          vehiculo_id: finalVehiculoId!,
          taller_id: tallerSeleccionadoId,
          tipo: payload.tipo ?? "",
          estado,
          fecha: fecha,
          kilometraje_leido: Number(km) || 0,
          precio_final: precioFinalCalculado,
          observaciones: payload.observaciones,
          esta_pago: payload.esta_pago,
          extra_data: payload.extra_data,
          detalles: internal.serviciosDraft.map((s) => ({
            descripcion: String(s.descripcion ?? "").trim(),
            cantidad: Number(s.cantidad) || 0,
            valor: Number(s.valor) || 0,
          })),
          repuestos: internal.repuestosDraft.map((r) => ({
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
        setEstado("SIN_INICIAR");
        setFecha("");
        setKm("");
        setObservaciones("");
        setEstaPago(false);
        setExtraData("");
        setInternal(createEmptyInternal());
        success("Arreglo creado", "El arreglo se registró correctamente.");
      } else {
        success("Arreglo actualizado", "Los cambios del arreglo se guardaron correctamente.");
      }

      if (!isEdit && response) {
        const label = response.esta_pago ? "detalle" : "presupuesto";
        const confirmed = await confirm({
          title: "Compartir arreglo",
          message: `¿Querés compartir el ${label} del arreglo recién creado?`,
          acceptLabel: "Compartir",
          cancelLabel: "Ahora no",
        });
        if (confirmed) {
          await handleShareArreglo(response.id);
        }
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
        maxHeight: "90dvh",
        overflow: "auto",
      }}
    >
      <div style={{ padding: "4px 0 12px" }}>
        <ArregloFormFields
          vehiculoId={vehiculoId}
          vehiculoOptions={vehiculoOptions}
          isEdit={isEdit}
          submitting={submitting}
          tallerId={tallerSeleccionadoId ?? null}
          values={fieldValues}
          onValuesChange={handleFieldsChange}
          onValidityChange={(next) => setIsValid(next)}
          onChange={(next) => setInternal(next)}
        />
      </div>

      {error && <div style={modalStyles.error}>{error}</div>}
    </Modal>
  );
}

const modalStyles = {
  error: { color: "#b00020", fontSize: 13, marginTop: 6 },
} as const;
