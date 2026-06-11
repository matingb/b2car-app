"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import NumberInput from "@/app/components/ui/NumberInput";
import { useEmpleados, type Empleado } from "@/app/providers/EmpleadosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  empleado: Empleado;
  onClose: () => void;
  onSaved: (updated: Empleado) => void;
};

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalarioUpdateModal({ open, empleado, onClose, onSaved }: Props) {
  const { updateEmpleado, isLoading } = useEmpleados();
  const { success } = useToast();

  const [salario, setSalario] = useState<number>(empleado.salario ?? 0);
  const [vigenteDesde, setVigenteDesde] = useState<string>(currentMonthValue());
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSalario(empleado.salario ?? 0);
    setVigenteDesde(currentMonthValue());
    setSubmitError(null);
  }, [open, empleado]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const { empleado: updated, error } = await updateEmpleado(empleado.id, {
      salario,
      salarioVigenteDesde: vigenteDesde ? `${vigenteDesde}-01` : undefined,
    });
    if (updated) {
      success("Salario actualizado", `Nuevo salario vigente desde ${formatMonth(vigenteDesde)}.`);
      onSaved(updated);
      onClose();
      return;
    }
    setSubmitError(error ?? "Ocurrió un error al actualizar el salario");
  };

  return (
    <Modal
      open={open}
      title="Actualizar salario"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Guardar"
      submitting={isLoading}
      disabledSubmit={salario < 0 || !vigenteDesde}
      modalError={
        submitError ? { titulo: "Error al actualizar salario", descripcion: submitError } : null
      }
    >
      <div style={styles.field}>
        <label style={styles.label}>Salario</label>
        <NumberInput
          minValue={0}
          value={salario}
          onValueChange={setSalario}
          placeholder="0"
        />
      </div>
      <div style={styles.field}>
        <label style={styles.label}>Vigente desde</label>
        <input
          type="month"
          style={styles.input}
          value={vigenteDesde}
          onChange={(e) => setVigenteDesde(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function formatMonth(ym: string): string {
  if (!ym) return "";
  const [year, month] = ym.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[Number(month) - 1]} ${year}`;
}

const styles = {
  field: { marginTop: 12 },
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
    fontSize: 14,
    outline: "none",
  },
} as const;
