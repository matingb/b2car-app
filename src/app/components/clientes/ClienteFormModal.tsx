"use client";

import React, { useState } from "react";
import Modal from "../ui/Modal";
import { TipoCliente } from "@/model/types";
import ClienteFormFields, {
  createEmptyClienteFormFieldsValue,
  type ClienteFormFieldsValue,
} from "./ClienteFormFields";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    nombre: string;
    apellido?: string;
    cuit?: string;
    codigo_pais?: string;
    telefono: string;
    email: string;
    direccion: string;
    tipo_cliente: TipoCliente;
  }) => Promise<void> | void;
  mode?: "create" | "edit";
  initialValues?: {
    nombre?: string;
    apellido?: string;
    cuit?: string;
    codigo_pais?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    tipo_cliente?: TipoCliente;
  };
};

export default function ClienteFormModal({
  open,
  onClose,
  onSubmit,
  mode = "create",
  initialValues,
}: Props) {
  const [cliente, setCliente] = useState<ClienteFormFieldsValue>(() => {
    const base = createEmptyClienteFormFieldsValue(
      initialValues?.tipo_cliente ?? TipoCliente.PARTICULAR
    );
    return {
      ...base,
      ...(initialValues ?? {}),
      codigoPais: initialValues?.codigo_pais ?? base.codigoPais,
      tipo_cliente: initialValues?.tipo_cliente ?? base.tipo_cliente,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);

  React.useEffect(() => {
    if (open && initialValues) {
      const base = createEmptyClienteFormFieldsValue(
        initialValues.tipo_cliente ?? TipoCliente.PARTICULAR
      );
      setCliente({
        ...base,
        ...initialValues,
      codigoPais: initialValues.codigo_pais ?? base.codigoPais,
      tipo_cliente: initialValues.tipo_cliente ?? base.tipo_cliente,
      });
    } else if (open && !initialValues) {
      setCliente(createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR));
    }
  }, [open, initialValues]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      await onSubmit({
        nombre: cliente.nombre.trim(),
        apellido:
          cliente.tipo_cliente === TipoCliente.PARTICULAR
            ? cliente.apellido.trim() || undefined
            : undefined,
        cuit:
          cliente.tipo_cliente === TipoCliente.EMPRESA
            ? cliente.cuit.trim()
            : undefined,
        codigo_pais: cliente.codigoPais || undefined,
        telefono: cliente.telefono.trim(),
        email: cliente.email.trim(),
        direccion: cliente.direccion.trim(),
        tipo_cliente: cliente.tipo_cliente,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ocurrió un error";
      console.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Guardar"
      submitting={submitting}
      disabledSubmit={!isValid}
    >
      <ClienteFormFields
        value={cliente}
        onChange={(patch) => setCliente((prev) => ({ ...prev, ...patch }))}
        disableTipo={mode === "edit"}
        onValidityChange={({ isValid }) => setIsValid(isValid)}
      />
    </Modal>
  );
}
