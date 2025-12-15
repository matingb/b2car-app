"use client";

import React from "react";
import { Vehiculo } from "@/model/types";
import VehiculoFormModal, { VehiculoFormValues } from "./VehiculoFormModal";

type Props = {
  open: boolean;
  onClose: (updated?: boolean) => void;
  vehiculo: Vehiculo;
};

export default function EditVehiculoModal({ open, onClose, vehiculo }: Props) {
  const handleSubmit = async (values: VehiculoFormValues): Promise<boolean> => {
    const res = await fetch(`/api/vehiculos/${vehiculo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patente: values.patente,
        marca: values.marca, // viaja como ""
        modelo: values.modelo, // viaja como ""
        fecha_patente: values.fecha_patente, // viaja como ""
      }),
    });
    const json = await res.json().catch(() => ({ error: "Error" }));
    if (!res.ok || json?.error) {
      throw new Error(json?.error || "No se pudo actualizar el vehículo");
    }
    return true;
  };

  return (
    <VehiculoFormModal
      open={open}
      title="Editar vehículo"
      submitText="Guardar cambios"
      onClose={(result?: boolean) => onClose(result)}
      onSubmit={handleSubmit}
      initialValues={{
        patente: vehiculo.patente ?? "",
        marca: vehiculo.marca ?? "",
        modelo: vehiculo.modelo ?? "",
        fecha_patente: vehiculo.fecha_patente ?? "",
      }}
      showClienteInput={false}
    />
  );
}

