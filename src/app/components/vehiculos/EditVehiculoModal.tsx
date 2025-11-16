"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { COLOR } from "@/theme/theme";
import { Vehiculo } from "@/model/types";

type Props = {
  open: boolean;
  onClose: (updated?: boolean) => void;
  vehiculo: Vehiculo;
};

export default function EditVehiculoModal({ open, onClose, vehiculo }: Props) {
  const [patente, setPatente] = useState(vehiculo.patente);
  const [marca, setMarca] = useState(vehiculo.marca);
  const [modelo, setModelo] = useState(vehiculo.modelo);
  const [fechaPatente, setFechaPatente] = useState(vehiculo.fecha_patente);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPatente(vehiculo.patente);
      setMarca(vehiculo.marca);
      setModelo(vehiculo.modelo);
      setFechaPatente(vehiculo.fecha_patente);
      setError(null);
    }
  }, [open, vehiculo]);

  const isValid = useMemo(() => patente.trim().length > 0, [patente]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehiculos/${vehiculo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patente: patente.trim().toUpperCase(),
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          fecha_patente: fechaPatente || undefined,
        }),
      });
      const json = await res.json().catch(() => ({ error: "Error" }));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || "No se pudo actualizar el vehículo");
      }
      onClose(true);
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
            <h2 style={styles.title}>Editar vehículo</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "4px 0 12px" }}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Patente <span style={{ color: "#d00" }}>*</span>
                  </label>
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
              <button
                type="button"
                style={styles.cancel}
                onClick={() => onClose()}
                disabled={submitting}
              >
                Cancelar
              </button>
              <Button
                text={submitting ? "Guardando..." : "Guardar cambios"}
                style={{ opacity: isValid ? 1 : 0.6 }}
                disabled={!isValid || submitting}
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

