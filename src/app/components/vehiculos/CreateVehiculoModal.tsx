"use client";

import React, { useMemo, useState, useEffect } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { COLOR } from "@/theme/theme";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";

type CreatedVehiculo = {
  patente: string;
  marca?: string;
  modelo?: string;
  fecha_patente?: string;
};

type Props = {
  open: boolean;
  onClose: (vehiculo?: CreatedVehiculo) => void;
  clienteId?: number | string; // optional: when missing, show selector to pick a cliente
};

export default function CreateVehiculoModal({ open, onClose, clienteId }: Props) {
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [fechaPatente, setFechaPatente] = useState(""); // YYYY
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientesOptions, setClientesOptions] = useState<AutocompleteOption[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>(
    clienteId ? String(clienteId) : ""
  );

  const isValid = useMemo(
    () => patente.trim().length > 0 && (clienteId ? true : selectedClienteId.trim().length > 0),
    [patente, clienteId, selectedClienteId]
  );

  useEffect(() => {
    if (!open) return;
    if (clienteId) {
      setSelectedClienteId(String(clienteId));
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/clientes");
        const json = await res.json().catch(() => ({ data: [] }));
        const opts: AutocompleteOption[] = (json.data || []).map((c: any) => ({
          value: String(c.id),
          label: String(c.nombre || ""),
          secondaryLabel: String(c.email || ""),
        }));
        if (mounted) setClientesOptions(opts);
      } catch (e) {
        // ignore fetch errors for selector
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, clienteId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const clienteToSend = clienteId ? clienteId : selectedClienteId;
      const res = await fetch("/api/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteToSend,
          patente: patente.trim().toUpperCase(),
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          fecha_patente: fechaPatente || undefined,
        }),
      });
      const json = await res.json().catch(() => ({ error: "Error" }));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || "No se pudo crear el vehículo");
      }
      onClose({
        patente: patente.trim().toUpperCase(),
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        fecha_patente: fechaPatente || undefined,
      });
      // reset
      setPatente("");
      setMarca("");
      setModelo("");
      setFechaPatente("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>Crear vehículo</h2>
          </div>
          <form onSubmit={handleSubmit}>
            {/* Selector de cliente si no se conoce de antemano */}
            {!clienteId && (
              <div style={{ marginBottom: 12 }}>
                <label style={styles.label}>Cliente <span style={{ color: "#d00" }}>*</span></label>
                <Autocomplete
                  options={clientesOptions}
                  value={selectedClienteId}
                  onChange={(v) => setSelectedClienteId(v)}
                  placeholder="Buscar cliente..."
                />
              </div>
            )}

            <div style={{ padding: "4px 0 12px" }}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Patente <span style={{ color: "#d00" }}>*</span></label>
                  <input
                    style={styles.input}
                    placeholder="AAA000 ~ AA000AA"
                    value={patente}
                    onChange={(e) => setPatente(e.target.value)}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Marca</label>
                  <input
                    style={styles.input}
                    placeholder="Toyota"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Modelo</label>
                  <input
                    style={styles.input}
                    placeholder="Corolla"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Año patente</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    style={styles.input}
                    placeholder="YYYY"
                    value={fechaPatente}
                    onChange={(e) => {
                      const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setFechaPatente(onlyDigits);
                    }}
                  />
                </div>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.footer}>
              <button type="button" style={styles.cancel} onClick={() => onClose()} disabled={submitting}>
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
    width: "min(640px, 92vw)",
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
