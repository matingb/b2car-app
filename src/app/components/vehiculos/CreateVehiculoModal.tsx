"use client";

import React, { useEffect, useState } from "react";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Modal from "../ui/Modal";
import VehiculoFormFields, {
  VehiculoFormFieldsValue,
} from "./VehiculoFormFields";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";

type CreatedVehiculo = {
  id: string;
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
  numero_chasis?: string;
  nro_interno?: string;
};

type Props = {
  open: boolean;
  onClose: (vehiculo?: CreatedVehiculo) => void;
  clienteId?: number | string; // optional: when missing, show selector to pick a cliente
  tipoCliente?: "particular" | "empresa";
};

export default function CreateVehiculoModal({
  open,
  onClose,
  clienteId,
  tipoCliente,
}: Props) {
  const { create } = useVehiculos();
  const { error: toastError, success } = useToast();
  const [values, setValues] = useState<VehiculoFormFieldsValue>({
    cliente_id: clienteId ? String(clienteId) : "",
    patente: "",
    marca: "",
    modelo: "",
    fecha_patente: "",
    numero_chasis: "",
    nro_interno: "",
  });
  const [isValid, setIsValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({
      cliente_id: clienteId ? String(clienteId) : "",
      patente: "",
      marca: "",
      modelo: "",
      fecha_patente: "",
      numero_chasis: "",
      nro_interno: "",
    });
    setIsValid(false);
    setSubmitting(false);
  }, [open, clienteId]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);

    const clienteToSend = clienteId ?? values.cliente_id;
    if (!clienteToSend) throw new Error("Debe seleccionar un cliente");

    try {
      const vehiculo_id = await create({
        cliente_id: clienteToSend,
        patente: values.patente.trim().toUpperCase(),
        marca: values.marca.trim() || "",
        modelo: values.modelo.trim() || "",
        fecha_patente: values.fecha_patente || "",
        numero_chasis: values.numero_chasis.trim() || "",
        nro_interno: values.nro_interno.trim() || null,
      });

      onClose({
        id: vehiculo_id ?? "",
        patente: values.patente.trim().toUpperCase(),
        marca: values.marca.trim() || undefined,
        modelo: values.modelo.trim() || undefined,
        fecha_patente: values.fecha_patente || undefined,
        numero_chasis: values.numero_chasis.trim() || undefined,
        nro_interno: values.nro_interno.trim() || undefined,
      });

      success(
        "Vehículo creado",
        `${formatPatenteConMarcaYModelo({ patente: values.patente, marca: values.marca, modelo: values.modelo })} se registró correctamente.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error";
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Crear vehículo"
      submitText="Guardar"
      onClose={() => onClose()}
      onSubmit={handleSubmit}
      submitting={submitting}
      disabledSubmit={!isValid}
    >
      <VehiculoFormFields
        value={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        showClienteInput={!clienteId}
        tipoCliente={tipoCliente}
        onValidityChange={(valid) => setIsValid(valid)}
      />
    </Modal>
  );
}
