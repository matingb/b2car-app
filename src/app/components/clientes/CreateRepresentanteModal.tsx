"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

interface Props {
  open: boolean;
  onClose: (created?: { nombre: string; apellido?: string; telefono?: string }) => void;
}

export default function CreateRepresentanteModal({ open, onClose }: Props) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const isValid = useMemo(() => nombre.trim().length > 0, [nombre]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    onClose({ nombre: nombre.trim(), apellido: apellido.trim() || undefined, telefono: telefono.trim() || undefined });
    setNombre("");
    setApellido("");
    setTelefono("");
    setSubmitting(false);
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>Crear representante</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '4px 0 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={styles.field}> 
                <label style={styles.label}>
                  Nombre <span aria-hidden="true" style={styles.required}>*</span>
                </label>
                <input style={styles.input} value={nombre} placeholder="Nombre" onChange={e => setNombre(e.target.value)} />
              </div>
              <div style={styles.field}> 
                <label style={styles.label}>Apellido</label>
                <input style={styles.input} value={apellido} placeholder="Apellido" onChange={e => setApellido(e.target.value)} />
              </div>
              <div style={styles.field}> 
                <label style={styles.label}>Teléfono</label>
                <input style={styles.input} value={telefono} placeholder="Teléfono" onChange={e => setTelefono(e.target.value)} />
              </div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.footer}>
              <button type="button" style={styles.cancel} disabled={submitting} onClick={() => onClose()}>Cancelar</button>
              <Button text={submitting ? 'Guardando...' : 'Guardar'} disabled={!isValid || submitting} style={{ opacity: isValid ? 1 : 0.6 }} />
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: { width: 'min(480px, 92vw)' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  required: { color: REQUIRED_ICON_COLOR, fontWeight: 700, marginLeft: 2 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancel: { background: 'transparent', border: `1px solid ${COLOR.BORDER.SUBTLE}`, color: COLOR.TEXT.PRIMARY, padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer' },
  error: { color: '#b00020', fontSize: 13, marginTop: 6 },
} as const;
