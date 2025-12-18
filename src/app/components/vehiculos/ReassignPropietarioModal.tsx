"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { COLOR } from "@/theme/theme";
import Autocomplete, { AutocompleteOption } from "@/app/components/ui/Autocomplete";

interface Props {
  open: boolean;
  vehiculoId: number | string;
  currentClienteId?: number | string | null;
  onClose: (updated?: boolean) => void;
}

export default function ReassignPropietarioModal({ open, vehiculoId, currentClienteId, onClose }: Props) {
  const [clientesOptions, setClientesOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNewClienteId, setSelectedNewClienteId] = useState<string>("");

  // Current owner option (read only)
  const currentOption = useMemo(() => {
    if (!currentClienteId) return undefined;
    return clientesOptions.find(o => o.value === String(currentClienteId));
  }, [currentClienteId, clientesOptions]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedNewClienteId("");
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/clientes");
        const json = await res.json().catch(() => ({ data: [] }));
        const opts: AutocompleteOption[] = (json.data || []).map((c: Record<string, unknown>) => ({
          value: String(c.id),
          label: String(c.nombre || ""),
          secondaryLabel: String(c.email || ""),
        }));
        if (active) setClientesOptions(opts);
      } catch (e) {
        console.error(e);
        if (active) setError("No se pudieron cargar los clientes");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open]);

  const isValid = useMemo(() => {
    if (!selectedNewClienteId) return false;
    if (currentClienteId && String(currentClienteId) === selectedNewClienteId) return false; // must differ
    return true;
  }, [selectedNewClienteId, currentClienteId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/cliente`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: selectedNewClienteId }),
      });
      const json = await res.json().catch(() => ({ error: "Error" }));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || "No se pudo reasignar el propietario");
      }
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>Reasignar propietario</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={styles.label}>Propietario actual</label>
                <Autocomplete
                  options={currentOption ? [currentOption] : []}
                  value={currentOption?.value || ""}
                  onChange={() => {}}
                  placeholder={loading ? "Cargando..." : "Sin propietario"}
                  disabled
                />
              </div>
              <div>
                <label style={styles.label}>Nuevo propietario <span style={{ color: "#d00" }}>*</span></label>
                <Autocomplete
                  options={clientesOptions}
                  value={selectedNewClienteId}
                  onChange={(v) => setSelectedNewClienteId(v)}
                  placeholder={loading ? "Cargando clientes..." : "Seleccionar cliente"}
                  disabled={loading}
                />
              </div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.footer}>
              <button type="button" style={styles.cancel} onClick={() => onClose()} disabled={submitting}>Cancelar</button>
              <Button 
                text={submitting ? "Guardando..." : "Guardar"} 
                disabled={!isValid || submitting} 
                style={{ opacity: isValid ? 1 : 0.6 }} 
                hideText={false}
              />
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
    width: "min(640px, 92vw)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { margin: 0 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  cancel: {
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
  error: { color: "#b00020", fontSize: 13, marginTop: 8 },
} as const;
