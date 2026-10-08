"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import Button from "@/app/components/ui/Button";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { useTenant } from "@/app/providers/TenantProvider";
import { remitosClient } from "@/clients/remitosClient";
import { Permission } from "@/lib/permissions";
import { evaluarRemitoR } from "@/lib/remitos/remitoValidation";
import type { RemitosConfiguracion, RemitosConfiguracionInput } from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";
import { remitoFormStyles } from "./remitoFormStyles";

type ConfigForm = {
  rCai: string;
  rCaiVencimiento: string;
  rPuntoEmision: string;
  rNumeroDesde: string;
  rNumeroHasta: string;
  rProximoNumero: string;
  rInicioActividades: string;
  xPuntoEmision: string;
  xProximoNumero: string;
};

function str(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function toForm(config: RemitosConfiguracion): ConfigForm {
  const { remitoR, remitoX } = config;
  return {
    rCai: str(remitoR.cai),
    rCaiVencimiento: str(remitoR.caiVencimiento),
    rPuntoEmision: str(remitoR.puntoEmision),
    rNumeroDesde: str(remitoR.numeroDesde),
    rNumeroHasta: str(remitoR.numeroHasta),
    rProximoNumero: str(remitoR.proximoNumero),
    rInicioActividades: str(remitoR.inicioActividades),
    xPuntoEmision: str(remitoX.puntoEmision),
    xProximoNumero: str(remitoX.proximoNumero),
  };
}

function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function textOrNull(value: string): string | null {
  return value.trim() || null;
}

function toInput(form: ConfigForm): RemitosConfiguracionInput {
  return {
    remitoR: {
      cai: textOrNull(form.rCai),
      caiVencimiento: textOrNull(form.rCaiVencimiento),
      puntoEmision: numberOrNull(form.rPuntoEmision),
      numeroDesde: numberOrNull(form.rNumeroDesde),
      numeroHasta: numberOrNull(form.rNumeroHasta),
      proximoNumero: Number(form.rProximoNumero),
      inicioActividades: textOrNull(form.rInicioActividades),
      autoimpresor: true,
      imprenta: {
        razonSocial: null,
        cuit: null,
        fechaImpresion: null,
        habilitacion: null,
      },
    },
    remitoX: {
      puntoEmision: Number(form.xPuntoEmision),
      proximoNumero: Number(form.xProximoNumero),
    },
  };
}

/** Configuración de numeración de remitos R y X por ambiente. Se guarda por separado de los datos fiscales. */
export default function RemitosConfiguracionCard() {
  const { hasPermission } = useTenant();
  const canEdit = hasPermission(Permission.ConfiguracionEdit) && hasPermission(Permission.FacturasEdit);
  const [config, setConfig] = useState<RemitosConfiguracion | null>(null);
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await remitosClient.getConfiguracion();
      setConfig(data);
      setForm(toForm(data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración de remitos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await remitosClient.saveConfiguracion(toInput(form));
      setConfig(data);
      setForm(toForm(data));
      setMessage("Configuración de remitos guardada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración de remitos");
    } finally {
      setSaving(false);
    }
  };

  const patch = (changes: Partial<ConfigForm>) => setForm((current) => (current ? { ...current, ...changes } : current));
  const disabled = !canEdit || saving;
  const estadoR = config ? evaluarRemitoR(config.remitoR) : null;

  return (
    <section style={styles.card} aria-labelledby="remitos-config-heading">
      <div style={styles.header}>
        <h3 id="remitos-config-heading" style={styles.title}>Remitos</h3>
        <p style={styles.description}>
          Numeración de Remitos R y X{config ? ` para el ambiente ${config.ambiente === "PRODUCCION" ? "de producción" : "de homologación"}` : ""}.
          Los remitos no se informan a ARCA.
        </p>
      </div>

      {loading ? <div style={styles.body}><ListSkeleton rows={3} /></div> : null}
      {!loading && !form && error ? <div style={styles.body}><Alert tone="danger" text={error} /></div> : null}

      {!loading && form && config ? (
        <form onSubmit={save} style={styles.body}>
          <div style={styles.subsection}>
            <div style={styles.subsectionHeader}>
              <h4 style={styles.subtitle}>Remito R</h4>
              <span style={styles.last}>Último emitido: {config.ultimoEmitido.R ?? "ninguno"}</span>
            </div>
            {estadoR?.emitible ? (
              <Alert tone="success" text="Listo para emitir." />
            ) : (
              <Alert tone="warning" text={`Para emitir: ${estadoR?.motivos.join(" ")}`} />
            )}
            <div style={remitoFormStyles.grid}>
              <Field id="remitos-r-cai" label="CAI">
                <input id="remitos-r-cai" inputMode="numeric" maxLength={14} disabled={disabled} value={form.rCai}
                  onChange={(event) => patch({ rCai: event.target.value })} style={remitoFormStyles.input} placeholder="14 dígitos" />
              </Field>
              <Field id="remitos-r-vencimiento" label="Vencimiento del CAI">
                <input id="remitos-r-vencimiento" type="date" disabled={disabled} value={form.rCaiVencimiento}
                  onChange={(event) => patch({ rCaiVencimiento: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-r-punto" label="Punto de emisión">
                <input id="remitos-r-punto" type="number" min={1} max={99999} disabled={disabled} value={form.rPuntoEmision}
                  onChange={(event) => patch({ rPuntoEmision: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-r-desde" label="Numeración autorizada desde">
                <input id="remitos-r-desde" type="number" min={1} disabled={disabled} value={form.rNumeroDesde}
                  onChange={(event) => patch({ rNumeroDesde: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-r-hasta" label="Numeración autorizada hasta">
                <input id="remitos-r-hasta" type="number" min={1} disabled={disabled} value={form.rNumeroHasta}
                  onChange={(event) => patch({ rNumeroHasta: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-r-proximo" label="Próximo número" required>
                <input id="remitos-r-proximo" type="number" min={1} required disabled={disabled} value={form.rProximoNumero}
                  onChange={(event) => patch({ rProximoNumero: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-r-inicio" label="Inicio de actividades del establecimiento">
                <input id="remitos-r-inicio" type="date" disabled={disabled} value={form.rInicioActividades}
                  onChange={(event) => patch({ rInicioActividades: event.target.value })} style={remitoFormStyles.input} />
              </Field>
            </div>
          </div>

          <div style={styles.subsection}>
            <div style={styles.subsectionHeader}>
              <h4 style={styles.subtitle}>Remito X</h4>
              <span style={styles.last}>Último emitido: {config.ultimoEmitido.X ?? "ninguno"}</span>
            </div>
            <div style={remitoFormStyles.grid}>
              <Field id="remitos-x-punto" label="Punto de emisión" required>
                <input id="remitos-x-punto" type="number" min={1} max={99999} required disabled={disabled} value={form.xPuntoEmision}
                  onChange={(event) => patch({ xPuntoEmision: event.target.value })} style={remitoFormStyles.input} />
              </Field>
              <Field id="remitos-x-proximo" label="Próximo número" required>
                <input id="remitos-x-proximo" type="number" min={1} required disabled={disabled} value={form.xProximoNumero}
                  onChange={(event) => patch({ xProximoNumero: event.target.value })} style={remitoFormStyles.input} />
              </Field>
            </div>
          </div>

          {error ? <Alert tone="danger" text={error} /> : null}
          {message ? <Alert tone="success" text={message} /> : null}

          {canEdit ? (
            <div style={styles.actions}>
              <Button
                type="submit"
                text={saving ? "Guardando…" : "Guardar configuración de remitos"}
                icon={<Save size={18} />}
                disabled={saving}
                hideTextOnMobile={false}
              />
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

function Field({ id, label, required = false, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={remitoFormStyles.field}>
      <label style={remitoFormStyles.label} htmlFor={id}>
        {label} {required ? <span style={remitoFormStyles.required}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

function Alert({ tone, text }: { tone: "danger" | "warning" | "success"; text: string }) {
  const palette = {
    danger: { color: COLOR.SEMANTIC.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, icon: <AlertCircle size={16} /> },
    warning: { color: COLOR.TEXT.PRIMARY, background: COLOR.BACKGROUND.WARNING_TINT, icon: <AlertTriangle size={16} color={COLOR.SEMANTIC.WARNING} /> },
    success: { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT, icon: <CheckCircle2 size={16} /> },
  }[tone];
  return (
    <div role={tone === "success" ? "status" : "alert"} style={{ ...styles.alert, color: palette.color, background: palette.background }}>
      <span style={{ flexShrink: 0, display: "flex" }}>{palette.icon}</span>
      <span>{text}</span>
    </div>
  );
}

const styles = {
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden" as const,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  header: {
    padding: "16px 20px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  title: { fontSize: 16, fontWeight: 600, color: COLOR.TEXT.PRIMARY, margin: 0 },
  description: { fontSize: 13, color: COLOR.TEXT.SECONDARY, margin: 0 },
  body: { padding: 20, display: "flex", flexDirection: "column" as const, gap: 20 },
  subsection: { display: "flex", flexDirection: "column" as const, gap: 12 },
  subsectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const },
  subtitle: { margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.TEXT.PRIMARY },
  last: { fontSize: 12, color: COLOR.TEXT.SECONDARY, fontFamily: "monospace" },
  alert: { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, fontSize: 13 },
  actions: { display: "flex", justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${COLOR.BORDER.SUBTLE}` },
} as const;
