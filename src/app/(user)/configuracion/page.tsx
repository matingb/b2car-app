"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Dropdown from "@/app/components/ui/Dropdown";
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
      const response = await fetch("/api/facturacion/configuracion", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo cargar la configuración fiscal");
      setConfig(body.data ?? emptyConfig);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración fiscal");
    } finally {
      setLoading(false);
    }
  }, []);

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
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo probar la conexión fiscal");
      setMessage(
        `Conexión correcta. Último comprobante: ${body.data.ultimoComprobante}.`,
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
            <p style={styles.groupDescription}>Datos fiscales, credenciales y emisión de comprobantes ARCA.</p>
          </div>
          <Card id="facturacion-electronica" style={styles.card}>
            {loading ? <p>Cargando configuración…</p> : null}
            {!loading ? (
              <form onSubmit={save} style={styles.form}>
                <div style={styles.fiscalFields}>
                  <div style={styles.fiscalRow}>
                    <Field label="CUIT" required style={styles.fieldThird}>
                      <input required inputMode="numeric" style={styles.input} value={config.cuit} onChange={(event) => update("cuit", event.target.value)} />
                    </Field>
                    <Field label="Razón social" required style={styles.fieldThird}>
                      <input required style={styles.input} value={config.razonSocial} onChange={(event) => update("razonSocial", event.target.value)} />
                    </Field>
                    <Field label="Nombre de fantasía" style={styles.fieldThird}>
                      <input style={styles.input} value={config.nombreFantasia ?? ""} onChange={(event) => update("nombreFantasia", event.target.value || null)} />
                    </Field>
                  </div>
                  <div style={styles.fiscalRow}>
                    <Field label="Domicilio" required style={styles.fieldTwoThirds}>
                      <input required style={styles.input} value={config.domicilio} onChange={(event) => update("domicilio", event.target.value)} />
                    </Field>
                    <Field label="Inicio de actividades" required style={styles.fieldThird}>
                      <input required type="date" style={styles.input} value={config.inicioActividades} onChange={(event) => update("inicioActividades", event.target.value)} />
                    </Field>
                  </div>
                  <div style={styles.fiscalRow}>
                    <Field label="Condición frente al IVA" required style={styles.fieldThird}>
                      <Dropdown
                        options={[
                          { value: "MONOTRIBUTISTA", label: "Monotributista" },
                          { value: "RESPONSABLE_INSCRIPTO", label: "Responsable inscripto" },
                        ]}
                        value={config.condicionIvaEmisor}
                        onChange={(value) => update("condicionIvaEmisor", value as FacturacionConfiguracionPublica["condicionIvaEmisor"])}
                        style={styles.dropdown}
                        dataTestId="facturacion-condicion-iva"
                      />
                    </Field>
                    <Field label="N° de inscripción IIBB" style={styles.fieldThird}>
                      <input style={styles.input} value={config.ingresosBrutos ?? ""} onChange={(event) => update("ingresosBrutos", event.target.value || null)} />
                    </Field>
                    <Field label="N° de punto de venta" required style={styles.fieldThird}>
                      <input required type="number" min={1} style={styles.input} value={config.puntoVenta} onChange={(event) => update("puntoVenta", Number(event.target.value))} />
                    </Field>
                  </div>
                </div>

                <div style={styles.credentialsBox}>
                  <div style={styles.credentialsHeader}>
                    <div>
                      <strong>Certificado y clave privada</strong>
                      <div style={styles.small}>Se guarda el par de certificados encriptados en nuestras bases.</div>
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
                  Habilitar emisión
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

function Field({ label, children, required, style }: { label: string; children: React.ReactNode; required?: boolean; style?: React.CSSProperties }) {
  return <label style={{ ...styles.field, ...style }}>{label}{required ? " *" : null}{children}</label>;
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
  form: { display: "flex", flexDirection: "column" as const, gap: 16 },
  fiscalFields: { display: "flex", flexDirection: "column" as const, gap: 14 },
  fiscalRow: { display: "flex", gap: 14, flexWrap: "wrap" as const },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  fieldThird: { flex: "1 1 220px", minWidth: 0 },
  fieldTwoThirds: { flex: "2 1 440px", minWidth: 0 },
  input: { height: 42, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 12px", color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND },
  dropdown: { width: "100%", minHeight: 42 },
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
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" as const },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8 },
  success: { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT, padding: 12, borderRadius: 8 },
} as const;
