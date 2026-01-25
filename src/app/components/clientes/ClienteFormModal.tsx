"use client";

import React, { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import { TipoCliente } from "@/model/types";
import Dropdown from "../ui/Dropdown";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from '@emotion/react'

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
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [apellido, setApellido] = useState(initialValues?.apellido ?? "");
  const [cuit, setCuit] = useState(initialValues?.cuit ?? "");
  const [telefono, setTelefono] = useState(initialValues?.telefono ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [direccion, setDireccion] = useState(initialValues?.direccion ?? "");
  const [tipo, setTipo] = useState<TipoCliente>(initialValues?.tipo_cliente ?? TipoCliente.PARTICULAR);
  const [submitting, setSubmitting] = useState(false);

  const tipoClienteOptions = useMemo(
    () => [
      { value: TipoCliente.PARTICULAR, label: "Particular" },
      { value: TipoCliente.EMPRESA, label: "Empresa" },
    ],
    []
  );

  // Sincronizar con initialValues cuando cambian
  React.useEffect(() => {
    if (open && initialValues) {
      setNombre(initialValues.nombre ?? "");
      setApellido(initialValues.apellido ?? "");
      setCuit(initialValues.cuit ?? "");
      setTelefono(initialValues.telefono ?? "");
      setEmail(initialValues.email ?? "");
      setDireccion(initialValues.direccion ?? "");
      setTipo(initialValues.tipo_cliente ?? TipoCliente.PARTICULAR);
    } else if (open && !initialValues) {
      // Reset en modo create
      setNombre("");
      setApellido("");
      setCuit("");
      setTelefono("");
      setEmail("");
      setDireccion("");
      setTipo(TipoCliente.PARTICULAR);
    }
  }, [open, initialValues]);

  const isValid = useMemo(() => {
    if (nombre.trim().length === 0) return false;
    if (apellido.trim().length === 0 && tipo === TipoCliente.PARTICULAR) return false;
    // CUIT obligatorio para empresas
    if (tipo === TipoCliente.EMPRESA && cuit.trim().length === 0) return false;
    return true;
  }, [nombre, tipo, cuit, apellido]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      await onSubmit({
        nombre: nombre.trim(),
        apellido: tipo === TipoCliente.PARTICULAR ? apellido.trim() || undefined : undefined,
        cuit: tipo === TipoCliente.EMPRESA ? cuit.trim() : undefined,
        telefono: telefono.trim(),
        email: email.trim(),
        direccion: direccion.trim(),
        tipo_cliente: tipo,
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
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>
              Nombre <span aria-hidden="true" style={styles.required}>*</span>
            </label>
            <input
              style={styles.input}
              placeholder={tipo === TipoCliente.EMPRESA ? "Nombre de la empresa" : "Nombre del cliente"}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          {tipo === TipoCliente.PARTICULAR && (
            <div style={styles.field}>
              <label style={styles.label}>
                Apellido <span aria-hidden="true" style={styles.required}>*</span>
              </label>
              <input
                style={styles.input}
                placeholder="Apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          )}
          {tipo === TipoCliente.EMPRESA && (
            <div style={styles.field}>
              <label style={styles.label}>
                CUIT <span aria-hidden="true" style={styles.required}>*</span>
              </label>
              <input style={styles.input} placeholder="XX-XXXXXXXX-X" value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
          )}
          <div style={{ ...styles.field, maxWidth: 160 }}>
            <label style={styles.label}>
              Tipo <span aria-hidden="true" style={styles.required}>*</span>
            </label>
            <Dropdown
              style={styles.dropdown}
              value={tipo}
              options={tipoClienteOptions}
              onChange={(value) => setTipo(value as TipoCliente)}
              disabled={mode === "edit"}
            />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Teléfono</label>
            <input style={styles.input} placeholder="+54 11 1234–5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} placeholder="email@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div css={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Dirección</label>
            <input style={styles.input} placeholder="Dirección completa" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export const styles = {
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  field: {
    flex: 1,
  },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  dropdown: {
    paddingRight: 8,
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 6,
  },
} as const; 