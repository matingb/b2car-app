"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import EmpleadoFormFields, {
  EmpleadoFormFieldsValues,
} from "@/app/components/empleados/EmpleadoFormFields";

type Props = {
  open: boolean;
  onClose: () => void;
};

function buildInitialValues(defaultTallerId: string): EmpleadoFormFieldsValues {
  return {
    tallerId: defaultTallerId,
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    telefono: "",
    cumpleanos: "",
    salario: null,
    fechaIngreso: "",
  };
}

export default function EmpleadoCreateModal({ open, onClose }: Props) {
  const { createEmpleado, isLoading } = useEmpleados();
  const { talleres } = useTenant();
  const { success } = useToast();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const defaultTallerId = talleres.length === 1 ? talleres[0].id : "";

  const [values, setValues] = useState<EmpleadoFormFieldsValues>(
    buildInitialValues(defaultTallerId)
  );

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setValues(buildInitialValues(defaultTallerId));
    setIsValid(false);
  }, [open, defaultTallerId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const { empleado: created, error: createError } = await createEmpleado({
      tallerId: values.tallerId,
      nombre: values.nombre,
      apellido: values.apellido,
      dni: values.dni,
      email: values.email,
      telefono: values.telefono,
      cumpleanos: values.cumpleanos,
      salario: values.salario,
      salarioVigenteDesde: values.salarioVigenteDesde,
      fechaIngreso: values.fechaIngreso,
    });

    if (created) {
      success("Empleado creado", `${values.nombre} ${values.apellido} se registró correctamente.`);
      onClose();
      return;
    }

    setSubmitError(createError ?? "Ocurrió un error al crear el empleado");
  };

  return (
    <Modal
      open={open}
      title="Nuevo empleado"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Crear"
      submitting={isLoading}
      disabledSubmit={!isValid}
      modalError={
        submitError
          ? { titulo: "Error al crear empleado", descripcion: submitError }
          : null
      }
      modalStyle={{ overflowY: "auto" }}
    >
      <EmpleadoFormFields
        talleres={talleres}
        values={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        onValidityChange={(isValid) => setIsValid(isValid)}
        mode="create"
      />
    </Modal>
  );
}
