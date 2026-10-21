"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import type { Proveedor } from "@/model/types";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }) => Promise<void>;
  initialValues?: Proveedor | null;
};

export default function ProveedorModal({
  open,
  onClose,
  onSubmit,
  initialValues,
}: Props) {
  const isEditing = Boolean(initialValues);

  const [nombre, setNombre] = useState("");
  const [cuit, setCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setNombre(initialValues.nombre || "");
        setCuit(initialValues.cuit || "");
        setTelefono(initialValues.telefono || "");
        setEmail(initialValues.email || "");
        setDireccion(initialValues.direccion || "");
      } else {
        setNombre("");
        setCuit("");
        setTelefono("");
        setEmail("");
        setDireccion("");
      }
      setValidationError(null);
    }
  }, [open, initialValues]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombre.trim();
    if (!cleanNombre) {
      setValidationError("El nombre o razón social es obligatorio.");
      return;
    }

    try {
      setSubmitting(true);
      setValidationError(null);
      await onSubmit({
        nombre: cleanNombre,
        cuit: cuit.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Error al guardar el proveedor");
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = nombre.trim().length > 0;

  return (
    <Modal
      open={open}
      title={isEditing ? "Editar Proveedor" : "Nuevo Proveedor"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={isEditing ? "Guardar cambios" : "Crear proveedor"}
      submitting={submitting}
      disabledSubmit={!isFormValid || submitting}
      modalStyle={{ width: "min(560px, 95vw)" }}
    >
      <div style={styles.formContainer}>
        {validationError && (
          <div style={styles.errorBanner}>{validationError}</div>
        )}

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Nombre / Razón Social <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Ej: Distribuidora Warnes SRL"
            style={styles.input}
            data-testid="proveedor-input-nombre"
            autoFocus
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            CUIT <span style={styles.optional}>(Opcional)</span>
          </label>
          <input
            type="text"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="Ej: 30-71234567-8 o 30712345678"
            style={styles.input}
            data-testid="proveedor-input-cuit"
          />
        </div>

        <div style={styles.row}>
          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <label style={styles.label}>
              Teléfono <span style={styles.optional}>(Opcional)</span>
            </label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 11 4455-6677"
              style={styles.input}
              data-testid="proveedor-input-telefono"
            />
          </div>

          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <label style={styles.label}>
              Email <span style={styles.optional}>(Opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ventas@proveedor.com"
              style={styles.input}
              data-testid="proveedor-input-email"
            />
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Dirección <span style={styles.optional}>(Opcional)</span>
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Ej: Av. Warnes 1234, CABA"
            style={styles.input}
            data-testid="proveedor-input-direccion"
          />
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  formContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: "8px 0",
  },
  row: {
    display: "flex",
    gap: 12,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  required: {
    color: COLOR.SEMANTIC.DANGER,
  },
  optional: {
    fontSize: 12,
    fontWeight: 400,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
  },
  errorBanner: {
    padding: "10px 14px",
    borderRadius: 8,
    background: "rgba(239, 68, 68, 0.12)",
    border: `1px solid ${COLOR.SEMANTIC.DANGER}`,
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 13,
    fontWeight: 500,
  },
};
