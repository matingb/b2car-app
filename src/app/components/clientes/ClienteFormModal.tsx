"use client";

import React, { useMemo, useState } from "react";
import { COLOR } from "@/theme/theme";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { TipoCliente } from "@/model/types";

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
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>{mode === 'edit' ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "4px 0 12px" }}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Nombre <span style={{color: "#d00"}}>*</span></label>
                  <input
                    style={styles.input}
                    placeholder={tipo === TipoCliente.EMPRESA ? "Nombre de la empresa" : "Nombre del cliente"}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                {tipo === TipoCliente.PARTICULAR && (
                  <div style={styles.field}>
                    <label style={styles.label}>Apellido <span style={{color: "#d00"}}>*</span></label>
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
                    <label style={styles.label}>CUIT <span style={{color: "#d00"}}>*</span></label>
                    <input
                      style={styles.input}
                      placeholder="XX-XXXXXXXX-X"
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                    />
                  </div>
                )}
                <div style={{ ...styles.field, maxWidth: 160 }}>
                  <label style={styles.label}>Tipo <span style={{color: "#d00"}}>*</span></label>
                  <select
                    style={{ ...styles.input, paddingRight: 8 }}
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoCliente)}
                  >
                    <option value={TipoCliente.PARTICULAR}>Particular</option>
                    <option value={TipoCliente.EMPRESA}>Empresa</option>
                  </select>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Teléfono</label>
                  <input
                    style={styles.input}
                    placeholder="+54 11 1234–5678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    style={styles.input}
                    placeholder="email@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={{ ...styles.field, flex: 1 }}>
                  <label style={styles.label}>Dirección</label>
                  <input
                    style={styles.input}
                    placeholder="Dirección completa"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/*error && <div style={styles.error}>{error}</div>*/}

            <div style={styles.footer}>
              <button type="button" style={styles.cancel} onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <Button text={submitting ? "Guardando..." : "Guardar"} style={{ opacity: isValid ? 1 : 0.6 }} disabled={!isValid || submitting} />
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: "min(760px, 92vw)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    margin: 0,
  },
  row: {
    display: "flex",
    gap: 16,
    marginTop: 10,
  },
  field: {
    flex: 1,
  },
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
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  cancel: {
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 6,
  },
} as const;

