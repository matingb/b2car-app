"use client";

import React, { useEffect, useState } from "react";
import { Vehiculo } from "@/model/types";
import Modal from "../ui/Modal";
import VehiculoFormFields, { VehiculoFormFieldsValue } from "./VehiculoFormFields";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { logger } from "@/lib/logger";

type Props = {
  open: boolean;
  onClose: (updated?: boolean) => void;
  vehiculo: Vehiculo;
  tipoCliente?: "particular" | "empresa";
};

export default function EditVehiculoModal({ open, onClose, vehiculo, tipoCliente }: Props) {
  const { update } = useVehiculos();
  const { error, success } = useToast();
  const [values, setValues] = useState<VehiculoFormFieldsValue>({
    cliente_id: "",
    patente: vehiculo.patente ?? "",
    marca: vehiculo.marca ?? "",
    modelo: vehiculo.modelo ?? "",
    fecha_patente: vehiculo.fecha_patente ?? "",
    nro_interno: vehiculo.nro_interno ?? "",
  });
  const [isValid, setIsValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  logger.debug("EditVehiculoModal render", { open, vehiculo });

  useEffect(() => {
    if (!open) return;
    setValues({
      cliente_id: "",
      patente: vehiculo.patente ?? "",
      marca: vehiculo.marca ?? "",
      modelo: vehiculo.modelo ?? "",
      fecha_patente: vehiculo.fecha_patente ?? "",
      nro_interno: vehiculo.nro_interno ?? "",
    });
    setIsValid(false);
    setSubmitting(false);
  }, [open, vehiculo]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      await update(vehiculo.id, {
        patente: values.patente.trim().toUpperCase(),
        marca: values.marca.trim() || "",
        modelo: values.modelo.trim() || "",
        fecha_patente: values.fecha_patente || "",
        nro_interno: values.nro_interno.trim() || "",
      });
      success("Vehículo actualizado correctamente");
      onClose(true);
    } catch {
      error("No se pudo actualizar el vehículo");
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Editar vehículo"
      submitText="Guardar cambios"
      onClose={() => onClose()}
      onSubmit={handleSubmit}
      submitting={submitting}
      disabledSubmit={!isValid}
    >
      <VehiculoFormFields
        value={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        showClienteInput={false}
        tipoCliente={tipoCliente}
        onValidityChange={(valid) => setIsValid(valid)}
      />
    </Modal>
  );
}

