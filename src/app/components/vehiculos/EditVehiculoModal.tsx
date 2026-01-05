"use client";

import React from "react";
import { Vehiculo } from "@/model/types";
import VehiculoFormModal, { VehiculoFormValues } from "./VehiculoFormModal";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";

type Props = {
  open: boolean;
  onClose: (updated?: boolean) => void;
  vehiculo: Vehiculo;
  tipoCliente?: "particular" | "empresa";
};

export default function EditVehiculoModal({ open, onClose, vehiculo, tipoCliente }: Props) {
  const { update } = useVehiculos();
  const { error, success } = useToast();

  const handleSubmit = async (values: VehiculoFormValues): Promise<boolean> => {
    try {
      await update(vehiculo.id, {
        patente: values.patente,
        marca: values.marca,
        modelo: values.modelo,
        fecha_patente: values.fecha_patente,
        nro_interno: values.nro_interno,
      });
      success("Vehículo actualizado correctamente");
    }
    catch {
      error("No se pudo actualizar el vehículo");
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
        nro_interno: vehiculo.nro_interno ?? "",
      }}
      showClienteInput={false}
      tipoCliente={tipoCliente}
    />
  );
}

