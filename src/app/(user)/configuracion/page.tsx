"use client";

import { useCallback, useEffect, useState } from "react";
import { ReceiptText, ShieldCheck, TriangleAlert } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { FacturacionConfiguracionPublica } from "@/lib/facturacion/types";

const emptyConfig: FacturacionConfiguracionPublica = {
  razonSocial: "",
  nombreFantasia: null,
  cuit: "",
  condicionIvaEmisor: "MONOTRIBUTISTA",
  domicilio: "",
  ingresosBrutos: null,
  inicioActividades: "",
  puntoVenta: 1,
  habilitada: false,
  ambiente: "HOMOLOGACION",
  fceMontoMinimo: null,
  credenciales: {
    configuradas: false,
    certificadoNombre: null,
    clavePrivadaNombre: null,
    fingerprintSha256: null,
    vencimiento: null,
    actualizadasAt: null,
  },
};

export default function ConfiguracionPage() {
  const [ambiente, setAmbiente] = useState<"HOMOLOGACION" | "PRODUCCION">("HOMOLOGACION");
  const [config, setConfig] = useState<FacturacionConfiguracionPublica>(emptyConfig);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/facturacion/configuracion?ambiente=${ambiente}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo cargar la configuración fiscal");
      setConfig(body.data ?? { ...emptyConfig, ambiente });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración fiscal");
    } finally {
      setLoading(false);
    }
  }, [ambiente]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof FacturacionConfiguracionPublica>(
    key: K,
    value: FacturacionConfiguracionPublica[K],
  ) => {
    setConfig((previous) => ({ ...previous, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (Boolean(certificate) !== Boolean(privateKey)) {
      setError("Para reemplazar las credenciales seleccioná el certificado y la clave privada.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("config", JSON.stringify(config));
      if (certificate && privateKey) {
        formData.append("certificate", certificate);
        formData.append("privateKey", privateKey);
      }
      const response = await fetch("/api/facturacion/configuracion", {
        method: "PUT",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la configuración fiscal");
      setConfig(body.data);
      setCertificate(null);
      setPrivateKey(null);
      setFileInputKey((value) => value + 1);
      setMessage(
        body.data.credenciales.configuradas
          ? "Configuración fiscal guardada y credenciales activas en Storage privado."
          : "Configuración guardada. Subí el certificado y la clave para habilitar la emisión.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración fiscal");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/facturacion/configuracion/probar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ambiente }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo probar la conexión fiscal");
      setMessage(
        `Conexión de ${ambiente.toLowerCase()} correcta. Último comprobante: ${body.data.ultimoComprobante}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo probar la conexión fiscal");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Configuración" breadcrumbs={["Administración"]} />
      <main style={styles.sections}>
        <section id="facturacion" style={styles.section}>
          <div style={styles.groupHeading}>
            <h2 style={styles.groupTitle}>Facturación</h2>
            <p style={styles.groupDescription}>Datos fiscales, credenciales y ambientes de emisión de comprobantes ARCA.</p>
          </div>
          <Card id="facturacion-electronica" style={styles.card}>
            <div style={styles.sectionHeading}>
              <div style={styles.headingIcon}><ReceiptText size={20} /></div>
              <div>
                <h2 style={styles.title}>Facturación electrónica</h2>
                <p style={styles.help}>
                  Configurá cada ambiente de forma independiente. El tipo de comprobante A, B o C se determina según la condición IVA del emisor y receptor.
                </p>
              </div>
              <label style={styles.environmentSelector}>Ambiente
                <select
                  style={styles.compactInput}
                  value={ambiente}
                  onChange={(event) => setAmbiente(event.target.value as "HOMOLOGACION" | "PRODUCCION")}
                  disabled={saving || testing}
                >
                  <option value="HOMOLOGACION">Homologación</option>
                  <option value="PRODUCCION">Producción</option>
                </select>
              </label>
            </div>

            {loading ? <p>Cargando configuración…</p> : null}
            {!loading ? (
              <form onSubmit={save} style={styles.form}>
                <div style={styles.grid}>
                  <Field label="Razón social" required>
                    <input required style={styles.input} value={config.razonSocial} onChange={(event) => update("razonSocial", event.target.value)} />
                  </Field>
                  <Field label="Nombre de fantasía">
                    <input style={styles.input} value={config.nombreFantasia ?? ""} onChange={(event) => update("nombreFantasia", event.target.value || null)} />
                  </Field>
                  <Field label="CUIT" required>
                    <input required inputMode="numeric" style={styles.input} value={config.cuit} onChange={(event) => update("cuit", event.target.value)} />
                  </Field>
                  <Field label="Condición IVA del emisor" required>
                    <select style={styles.input} value={config.condicionIvaEmisor} onChange={(event) => update("condicionIvaEmisor", event.target.value as FacturacionConfiguracionPublica["condicionIvaEmisor"])}>
                      <option value="MONOTRIBUTISTA">Monotributista</option>
                      <option value="RESPONSABLE_INSCRIPTO">Responsable inscripto</option>
                    </select>
                  </Field>
                  <Field label="Punto de venta exclusivo" required>
                    <input required type="number" min={1} style={styles.input} value={config.puntoVenta} onChange={(event) => update("puntoVenta", Number(event.target.value))} />
                  </Field>
                  <Field label="Domicilio" required wide>
                    <input required style={styles.input} value={config.domicilio} onChange={(event) => update("domicilio", event.target.value)} />
                  </Field>
                  <Field label="Ingresos Brutos">
                    <input style={styles.input} value={config.ingresosBrutos ?? ""} onChange={(event) => update("ingresosBrutos", event.target.value || null)} />
                  </Field>
                  <Field label="Inicio de actividades" required>
                    <input required type="date" style={styles.input} value={config.inicioActividades} onChange={(event) => update("inicioActividades", event.target.value)} />
                  </Field>
                  <Field label="Monto mínimo FCE MiPyME">
                    <input type="number" min={0} step="0.01" style={styles.input} value={config.fceMontoMinimo ?? ""} onChange={(event) => update("fceMontoMinimo", event.target.value ? Number(event.target.value) : null)} placeholder="Dejar vacío si no está configurado" />
                  </Field>
                </div>

                {ambiente === "PRODUCCION" ? (
                  <div style={styles.productionWarning}>
                    <TriangleAlert size={18} />
                    Producción genera comprobantes fiscales reales. Verificá CUIT, punto de venta y credenciales antes de habilitarla.
                  </div>
                ) : null}

                <div style={styles.credentialsBox}>
                  <div style={styles.credentialsHeader}>
                    <div>
                      <strong>Certificado y clave privada</strong>
                      <div style={styles.small}>Se guardan como un par versionado en un bucket privado de Supabase.</div>
                    </div>
                    <div style={config.credenciales.configuradas ? styles.readyBadge : styles.missingBadge}>
                      <ShieldCheck size={15} />
                      {config.credenciales.configuradas ? "Credenciales activas" : "Credenciales pendientes"}
                    </div>
                  </div>

                  {config.credenciales.configuradas ? (
                    <div style={styles.metadataGrid}>
                      <Metadata label="Certificado" value={config.credenciales.certificadoNombre ?? "-"} />
                      <Metadata label="Clave privada" value={config.credenciales.clavePrivadaNombre ?? "-"} />
                      <Metadata label="Vencimiento" value={formatDate(config.credenciales.vencimiento)} />
                      <Metadata label="Fingerprint SHA-256" value={config.credenciales.fingerprintSha256 ?? "-"} mono />
                    </div>
                  ) : null}

                  <div style={styles.grid} key={fileInputKey}>
                    <Field label={config.credenciales.configuradas ? "Reemplazar certificado (.crt o .pem)" : "Certificado (.crt o .pem)"}>
                      <input type="file" accept=".crt,.pem" style={styles.fileInput} onChange={(event) => setCertificate(event.target.files?.[0] ?? null)} />
                    </Field>
                    <Field label={config.credenciales.configuradas ? "Reemplazar clave privada (.key o .pem)" : "Clave privada (.key o .pem)"}>
                      <input type="file" accept=".key,.pem" style={styles.fileInput} onChange={(event) => setPrivateKey(event.target.files?.[0] ?? null)} />
                    </Field>
                  </div>
                  <span style={styles.small}>Máximo 64 KiB por archivo. Las claves con passphrase no están admitidas.</span>
                </div>

                <label style={styles.checkbox}>
                  <input type="checkbox" checked={config.habilitada} onChange={(event) => update("habilitada", event.target.checked)} />
                  Habilitar emisión de {ambiente.toLowerCase()}
                </label>

                {error ? <div style={styles.error}>{error}</div> : null}
                {message ? <div style={styles.success}>{message}</div> : null}
                <div style={styles.actions}>
                  <Button
                    type="button"
                    text={testing ? "Probando…" : "Probar conexión"}
                    outline
                    disabled={testing || saving || !config.credenciales.configuradas}
                    onClick={testConnection}
                    hideTextOnMobile={false}
                  />
                  <Button type="submit" text={saving ? "Guardando…" : "Guardar configuración"} disabled={saving || testing} hideTextOnMobile={false} />
                </div>
              </form>
            ) : null}
          </Card>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children, required, wide }: { label: string; children: React.ReactNode; required?: boolean; wide?: boolean }) {
  return <label style={{ ...styles.field, ...(wide ? styles.wide : {}) }}>{label}{required ? " *" : null}{children}</label>;
}

function Metadata({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div style={styles.metadata}><span>{label}</span><strong style={mono ? styles.mono : undefined}>{value}</strong></div>;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-AR");
}

const styles = {
  sections: { display: "flex", flexDirection: "column" as const, gap: 32, marginTop: 20, maxWidth: 980 },
  section: { display: "flex", flexDirection: "column" as const, gap: 14 },
  groupHeading: { display: "flex", flexDirection: "column" as const, gap: 4 },
  groupTitle: { fontSize: 22, margin: 0 },
  groupDescription: { color: COLOR.TEXT.SECONDARY, lineHeight: 1.5, margin: 0 },
  card: { width: "100%" },
  sectionHeading: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" as const },
  headingIcon: { width: 40, height: 40, borderRadius: 10, background: COLOR.BACKGROUND.SUBTLE, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR.ACCENT.PRIMARY },
  title: { fontSize: 20, margin: "0 0 4px" },
  help: { color: COLOR.TEXT.SECONDARY, lineHeight: 1.5, margin: 0, maxWidth: 650 },
  environmentSelector: { marginLeft: "auto", display: "flex", flexDirection: "column" as const, gap: 4, color: COLOR.TEXT.SECONDARY, fontSize: 11, fontWeight: 700 },
  compactInput: { height: 34, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 9px", color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  form: { display: "flex", flexDirection: "column" as const, gap: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  wide: { gridColumn: "1 / -1" },
  input: { height: 42, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 12px", color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  fileInput: { minHeight: 42, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: 9, color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  credentialsBox: { display: "flex", flexDirection: "column" as const, gap: 12, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 10, padding: 14, background: COLOR.BACKGROUND.SUBTLE },
  credentialsHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const },
  readyBadge: { display: "flex", alignItems: "center", gap: 6, color: COLOR.SEMANTIC.SUCCESS, fontSize: 12, fontWeight: 700 },
  missingBadge: { display: "flex", alignItems: "center", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 12, fontWeight: 700 },
  metadataGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 },
  metadata: { display: "flex", flexDirection: "column" as const, gap: 3, minWidth: 0, color: COLOR.TEXT.TERTIARY, fontSize: 11 },
  mono: { fontFamily: "monospace", fontSize: 11, overflowWrap: "anywhere" as const },
  small: { color: COLOR.TEXT.TERTIARY, fontSize: 13 },
  checkbox: { display: "flex", alignItems: "center", gap: 8, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  productionWarning: { display: "flex", alignItems: "flex-start", gap: 9, borderRadius: 8, padding: 12, color: COLOR.SEMANTIC.WARNING, background: COLOR.BACKGROUND.SUBTLE, border: `1px solid ${COLOR.SEMANTIC.WARNING}` },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" as const },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8 },
  success: { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT, padding: 12, borderRadius: 8 },
} as const;
