"use client";

import React from "react";
import Modal from "@/app/components/ui/Modal";
import { type OperacionModalProps } from "./operacionModalTypes";
import { OperacionFormProvider, useOperacionForm } from "./OperacionFormContext";
import OperacionHeaderFields from "./OperacionHeaderFields";
import OperacionGastoForm from "./OperacionGastoForm";
import OperacionStockForm from "./OperacionStockForm";

function OperacionCreateModalContent({ onClose }: { onClose: () => void }) {
  const {
    open,
    tipo,
    isEditingGasto,
    canSubmit,
    isSubmitting,
    submitForm,
  } = useOperacionForm();

  const title = isEditingGasto
    ? "Editar gasto"
    : "Nueva operación";

  const submitText = isEditingGasto
    ? "Guardar cambios"
    : "Crear";

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={submitForm}
      submitText={submitText}
      submitting={isSubmitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(860px, 96vw)", overflowY: "auto" }}
    >
      <div style={{ padding: "8px 0 12px", minHeight: "385px" }}>
        <OperacionHeaderFields />
        {tipo === "GASTO" ? <OperacionGastoForm /> : <OperacionStockForm />}
      </div>
    </Modal>
  );
}
export default function OperacionCreateModal(props: OperacionModalProps) {
  return (
    <OperacionFormProvider {...props}>
      <OperacionCreateModalContent onClose={props.onClose} />
    </OperacionFormProvider>
  );
}
