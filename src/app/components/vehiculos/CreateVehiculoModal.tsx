"use client";

import React from "react";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import VehiculoFormModal, { VehiculoFormValues } from "./VehiculoFormModal";

type CreatedVehiculo = {
  id: number;
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
  nro_interno?: string;
};

type Props = {
  open: boolean;
  onClose: (vehiculo?: CreatedVehiculo) => void;
  clienteId?: number | string; // optional: when missing, show selector to pick a cliente
};

export default function CreateVehiculoModal({ open, onClose, clienteId }: Props) {
  const { create } = useVehiculos();

  const handleSubmit = async (values: VehiculoFormValues): Promise<CreatedVehiculo> => {
    const clienteToSend = clienteId ?? values.cliente_id;
    if (!clienteToSend) throw new Error("Debe seleccionar un cliente");

    const vehiculo_id = await create({
      cliente_id: clienteToSend,
      patente: values.patente,
      marca: values.marca,
      modelo: values.modelo,
      fecha_patente: values.fecha_patente,
      nro_interno: values.nro_interno || null,
    });

    return {
      id: vehiculo_id ?? 0,
      patente: values.patente,
      marca: values.marca || undefined,
      modelo: values.modelo || undefined,
      fecha_patente: values.fecha_patente || undefined,
      nro_interno: values.nro_interno || undefined,
    };
  };

  return (
    <VehiculoFormModal
      open={open}
      title="Crear vehículo"
      submitText="Guardar"
      onClose={onClose}
      onSubmit={handleSubmit}
      initialValues={{ patente: "", marca: "", modelo: "", fecha_patente: "", nro_interno: "" }}
      showClienteInput={!clienteId}
      clienteId={clienteId}
    />
  );
}
