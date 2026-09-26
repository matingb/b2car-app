"use client";

import React, { useEffect, useState } from "react";
import { Building2, CheckCircle2, Info, Loader2 } from "lucide-react";
import Button from "@/app/components/ui/Button";
import ListSpinner from "@/app/components/ui/ListSpinner";
import TallerSelector from "@/app/components/ui/TallerSelector";
import { useTenant } from "@/app/providers/TenantProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import type { Taller } from "@/model/types";

type TallerDraft = {
  nombre: string;
  ubicacion: string;
  valorHora: string;
};

export default function TalleresPage() {
  const {
    talleres,
    loading,
    updateTaller,
    tallerSeleccionadoId,
    setTallerSeleccionadoId,
  } = useTenant();
  const toast = useToast();

  const [drafts, setDrafts] = useState<Record<string, TallerDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const activeTallerId = talleres.some((taller) => taller.id === tallerSeleccionadoId)
    ? tallerSeleccionadoId
    : talleres[0]?.id ?? "";
  const currentTaller = talleres.find((taller) => taller.id === activeTallerId);

  useEffect(() => {
    if (activeTallerId && activeTallerId !== tallerSeleccionadoId) {
      setTallerSeleccionadoId(activeTallerId);
    }
  }, [activeTallerId, setTallerSeleccionadoId, tallerSeleccionadoId]);

  useEffect(() => {
    if (talleres.length > 0) {
      setDrafts((prev) => {
        const next: Record<string, TallerDraft> = { ...prev };
        talleres.forEach((t) => {
          if (!next[t.id]) {
            next[t.id] = {
              nombre: t.nombre ?? "",
              ubicacion: t.ubicacion ?? "",
              valorHora: t.valor_hora != null ? String(t.valor_hora) : "0",
            };
          }
        });
        return next;
      });
    }
  }, [talleres]);

  const handleFieldChange = (id: string, field: keyof TallerDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { nombre: "", ubicacion: "", valorHora: "0" }),
        [field]: value,
      },
    }));
  };

  const handleSave = async (taller: Taller) => {
    const draft = drafts[taller.id] ?? {
      nombre: taller.nombre,
      ubicacion: taller.ubicacion,
      valorHora: String(taller.valor_hora ?? 0),
    };

    const trimmedNombre = draft.nombre.trim();
    if (!trimmedNombre) {
      toast.error("Error de validación", "El nombre del taller es obligatorio.");
      return;
    }

    const valorHoraNum = Number(draft.valorHora);
    if (isNaN(valorHoraNum) || valorHoraNum < 0) {
      toast.error(
        "Error de validación",
        "El precio por hora debe ser un número mayor o igual a 0."
      );
      return;
    }

    setSavingId(taller.id);
    try {
      const { error } = await updateTaller(taller.id, {
        nombre: trimmedNombre,
        ubicacion: draft.ubicacion.trim(),
        valor_hora: valorHoraNum,
      });

      if (error) {
        toast.error("No se pudo guardar", error);
      } else {
        toast.success("Taller guardado", "Los datos se actualizaron correctamente.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al guardar";
      toast.error("Error", msg);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <TallerSelector
        value={activeTallerId}
        onChange={setTallerSeleccionadoId}
      />

      <main style={styles.content}>
        {loading && talleres.length === 0 ? (
          <div style={styles.spinnerWrapper}>
            <ListSpinner />
          </div>
        ) : talleres.length === 0 || !currentTaller ? (
          <section style={styles.card}>
            <div style={styles.emptyState}>
              <Building2 size={36} color={COLOR.ICON.MUTED} />
              <p style={styles.emptyText}>No hay talleres configurados para este negocio.</p>
            </div>
          </section>
        ) : (
          <div style={styles.gridContainer}>
            {(() => {
              const taller = currentTaller;
              const draft = drafts[taller.id] ?? {
                nombre: taller.nombre ?? "",
                ubicacion: taller.ubicacion ?? "",
                valorHora: String(taller.valor_hora ?? 0),
              };
              const isSaving = savingId === taller.id;

              return (
                <section
                  key={taller.id}
                  style={styles.card}
                  aria-labelledby={`taller-title-${taller.id}`}
                >
                  <header style={styles.cardHeader}>
                    <div style={styles.headerLeft}>
                      <div style={styles.iconContainer}>
                        <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
                      </div>
                      <div>
                        <h2 id={`taller-title-${taller.id}`} style={styles.cardTitle}>
                          {taller.nombre || "Taller sin nombre"}
                        </h2>
                        {taller.ubicacion ? (
                          <p style={styles.cardSubtitle}>{taller.ubicacion}</p>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  <div style={styles.cardBody}>
                    <div style={styles.infoBox}>
                      <Info size={18} color={COLOR.ACCENT.PRIMARY} style={{ flexShrink: 0 }} />
                      <p style={styles.infoText}>
                        El <strong>precio por hora</strong> configurado se precargará automáticamente al agregar nuevas líneas de mano de obra en arreglos.
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSave(taller);
                      }}
                      style={styles.form}
                    >
                      <div style={styles.formGrid}>
                        <div style={styles.field}>
                          <label htmlFor={`nombre-${taller.id}`} style={styles.label}>
                            Nombre del taller <span style={styles.required}>*</span>
                          </label>
                          <input
                            id={`nombre-${taller.id}`}
                            type="text"
                            required
                            disabled={isSaving}
                            value={draft.nombre}
                            onChange={(e) => handleFieldChange(taller.id, "nombre", e.target.value)}
                            placeholder="Ej: Taller Central"
                            style={styles.input}
                          />
                        </div>

                        <div style={styles.field}>
                          <label htmlFor={`ubicacion-${taller.id}`} style={styles.label}>
                            Ubicación
                          </label>
                          <input
                            id={`ubicacion-${taller.id}`}
                            type="text"
                            disabled={isSaving}
                            value={draft.ubicacion}
                            onChange={(e) => handleFieldChange(taller.id, "ubicacion", e.target.value)}
                            placeholder="Ej: Av. Belgrano 1234, Ramos Mejía"
                            style={styles.input}
                          />
                        </div>

                        <div style={styles.field}>
                          <label htmlFor={`valor-hora-${taller.id}`} style={styles.label}>
                            Precio Hora ($/h) <span style={styles.required}>*</span>
                          </label>
                          <input
                            id={`valor-hora-${taller.id}`}
                            type="number"
                            min="0"
                            step="100"
                            inputMode="numeric"
                            required
                            disabled={isSaving}
                            value={draft.valorHora}
                            onChange={(e) => handleFieldChange(taller.id, "valorHora", e.target.value)}
                            placeholder="Ej: 15000"
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div style={styles.actionRow}>
                        <Button
                          text={isSaving ? "Guardando..." : "Guardar cambios"}
                          disabled={isSaving}
                          icon={
                            isSaving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )
                          }
                          hideTextOnMobile={false}
                          type="submit"
                        />
                      </div>
                    </form>
                  </div>
                </section>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
    paddingBottom: 40,
  },
  content: {
    maxWidth: 900,
    width: "100%",
  },
  spinnerWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "48px 0",
  },
  gridContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden" as const,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  cardHeader: {
    padding: "16px 20px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
    marginTop: 2,
  },
  cardBody: {
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  infoText: {
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  actionRow: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  emptyState: {
    padding: 40,
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
};
