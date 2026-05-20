"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useEmpleados, type Empleado } from "@/app/providers/EmpleadosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import EmpleadoFormFields, {
  EmpleadoFormFieldsValues,
} from "@/app/components/empleados/EmpleadoFormFields";

type Props = {
  open: boolean;
  empleado: Empleado;
  onClose: () => void;
  onSaved?: (empleado: Empleado) => void;
};

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildInitialValues(empleado: Empleado): EmpleadoFormFieldsValues {
  return {
    tallerId: empleado.tallerId,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    dni: empleado.dni,
    email: empleado.email,
    telefono: empleado.telefono,
    cumpleanos: empleado.cumpleanos,
    salario: empleado.salario,
    salarioVigenteDesde: currentMonthValue(),
    fechaIngreso: empleado.fechaIngreso,
  };
}

export default function EmpleadoEditModal({ open, empleado, onClose, onSaved }: Props) {
  const { updateEmpleado, isLoading } = useEmpleados();
  const { talleres } = useTenant();
  const { success } = useToast();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [values, setValues] = useState<EmpleadoFormFieldsValues>(buildInitialValues(empleado));

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setValues(buildInitialValues(empleado));
    setIsValid(true);
  }, [open, empleado]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const salarioChanged = values.salario !== empleado.salario;
    const { empleado: updated, error: updateError } = await updateEmpleado(empleado.id, {
      tallerId: values.tallerId,
      nombre: values.nombre,
      apellido: values.apellido,
      dni: values.dni,
      email: values.email,
      telefono: values.telefono,
      cumpleanos: values.cumpleanos,
      salario: values.salario,
      ...(salarioChanged && values.salarioVigenteDesde
        ? { salarioVigenteDesde: `${values.salarioVigenteDesde}-01` }
        : {}),
      fechaIngreso: values.fechaIngreso,
    });

    if (updated) {
      success("Empleado actualizado", `${values.nombre} ${values.apellido} se actualizó correctamente.`);
      onSaved?.(updated);
      onClose();
      return;
    }

    setSubmitError(updateError ?? "Ocurrió un error al actualizar el empleado");
  };

  return (
    <Modal
      open={open}
      title="Editar empleado"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Guardar"
      submitting={isLoading}
      disabledSubmit={!isValid}
      modalError={
        submitError
          ? { titulo: "Error al actualizar empleado", descripcion: submitError }
          : null
      }
      modalStyle={{ overflowY: "auto" }}
    >
      <EmpleadoFormFields
        talleres={talleres}
        values={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        onValidityChange={(isValid) => setIsValid(isValid)}
        showSalarioVigenteDesde
      />
    </Modal>
  );
}
