"use client";

import React, { useState } from "react";
import Modal from "../ui/Modal";
import { TipoCliente } from "@/model/types";
import ClienteFormFields, { type ClienteFormFieldsValue } from "./ClienteFormFields";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    nombre: string;
    apellido?: string;
    cuit?: string;
    telefono: string;
    email: string;
    direccion: string;
    tipo_cliente: TipoCliente;
  }) => Promise<void> | void;
  mode?: 'create' | 'edit';
  initialValues?: {
    nombre?: string;
    apellido?: string;
    cuit?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    tipo_cliente?: TipoCliente;
  };
};

export default function ClienteFormModal({ open, onClose, onSubmit, mode = 'create', initialValues }: Props) {
  const [cliente, setCliente] = useState<ClienteFormFieldsValue>({
    nombre: initialValues?.nombre ?? "",
    apellido: initialValues?.apellido ?? "",
    cuit: initialValues?.cuit ?? "",
    telefono: initialValues?.telefono ?? "",
    email: initialValues?.email ?? "",
    direccion: initialValues?.direccion ?? "",
    tipo_cliente: initialValues?.tipo_cliente ?? TipoCliente.PARTICULAR,
  });
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);

  // Sincronizar con initialValues cuando cambian
  React.useEffect(() => {
    if (open && initialValues) {
      setCliente({
        nombre: initialValues.nombre ?? "",
        apellido: initialValues.apellido ?? "",
        cuit: initialValues.cuit ?? "",
        telefono: initialValues.telefono ?? "",
        email: initialValues.email ?? "",
        direccion: initialValues.direccion ?? "",
        tipo_cliente: initialValues.tipo_cliente ?? TipoCliente.PARTICULAR,
      });
    } else if (open && !initialValues) {
      // Reset en modo create
      setCliente({
        nombre: "",
        apellido: "",
        cuit: "",
        telefono: "",
        email: "",
        direccion: "",
        tipo_cliente: TipoCliente.PARTICULAR,
      });
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
        apellido: cliente.tipo_cliente === TipoCliente.PARTICULAR ? cliente.apellido.trim() || undefined : undefined,
        cuit: cliente.tipo_cliente === TipoCliente.EMPRESA ? cliente.cuit.trim() : undefined,
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
