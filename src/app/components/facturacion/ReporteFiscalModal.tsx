"use client";

import { useState, type ReactNode } from "react";
import Modal from "@/app/components/ui/Modal";
import Calendar from "@/app/components/ui/Calendar";
import { formatCalendarDateLabel, parseCalendarDate, toISODateAppTimeZone } from "@/lib/fechas";
import { fiscalFilename, parseFiscalFilters } from "@/lib/facturacion/reporteFiscal";
import { COLOR } from "@/theme/theme";

function currentMonth() {
  const today = toISODateAppTimeZone();
  const { year, month } = parseCalendarDate(today)!;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { desde: `${today.slice(0, 7)}-01`, hasta: `${today.slice(0, 7)}-${lastDay}` };
}

/** Mounted on open so each request starts with independent, current GMT-3 defaults. */
export default function ReporteFiscalModal({ onClose }: { onClose: () => void }) {
  const [filters, setFilters] = useState(() => ({ ...currentMonth(), format: "xlsx", documentoTipo: "", origenTipo: "", cuitEmisor: "" }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));

  async function download() {
    setError("");
    const query = new URLSearchParams({ reporte: "fiscal", ...filters });
    let validated;
    try { validated = parseFiscalFilters(query); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Revisá los filtros"); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/facturas/export?${query}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo generar el reporte fiscal");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fiscalFilename(validated);
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      // Give the browser time to start consuming the download before releasing the URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo descargar el reporte"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open title="Reporte fiscal de ventas" onClose={onClose} onSubmit={download} submitText="Descargar reporte" submittingText="Generando reporte…" submitting={submitting}>
      <div style={styles.content}>
        <p style={styles.scope}><strong>Comprobantes autorizados</strong><br />Se incluyen únicamente los del ambiente configurado para facturación. Facturas, notas de crédito y débito de arreglos y ventas, incluidas las FCE. Período inclusivo por fecha del comprobante.</p>
        <p style={styles.help}>Este reporte usa sus propios filtros. CSV y Excel del listado descargan los filtros del listado.</p>
        <fieldset disabled={submitting} style={styles.fields}>
          <div style={styles.dates}>
            {(["desde", "hasta"] as const).map(key => (
              <div key={key} style={styles.field}>
                <span>Fecha {key}</span>
                <Calendar value={filters[key]} onChange={value => update(key, value)} dataTestId={`reporte-fiscal-${key}`}>
                  <button type="button" aria-label={`Elegir fecha ${key} del reporte`} style={styles.input}>
                    {formatCalendarDateLabel(filters[key])}
                  </button>
                </Calendar>
              </div>
            ))}
          </div>
          <Field label="Documento del reporte">
            <select style={styles.input} value={filters.documentoTipo} onChange={e => update("documentoTipo", e.target.value)}>
              <option value="">Todos los documentos</option><option value="FACTURA">Facturas</option><option value="NOTA_CREDITO">Notas de crédito</option><option value="NOTA_DEBITO">Notas de débito</option>
            </select>
          </Field>
          <Field label="Origen del reporte">
            <select style={styles.input} value={filters.origenTipo} onChange={e => update("origenTipo", e.target.value)}>
              <option value="">Todos los orígenes</option><option value="ARREGLO">Arreglos</option><option value="VENTA">Ventas</option>
            </select>
          </Field>
          <Field label="CUIT emisor (opcional)">
            <input style={styles.input} inputMode="numeric" placeholder="Todos los emisores" maxLength={11} value={filters.cuitEmisor} onChange={e => update("cuitEmisor", e.target.value)} />
          </Field>
          <Field label="Formato del reporte">
            <select style={styles.input} value={filters.format} onChange={e => update("format", e.target.value)}>
              <option value="xlsx">Excel (.xlsx), resumen y comprobantes</option><option value="csv">CSV (.csv), comprobantes</option>
            </select>
          </Field>
        </fieldset>
        <p style={styles.help}>Los desgloses desconocidos quedan vacíos y se explican en Observaciones.</p>
        {error ? <p role="alert" style={styles.error}>{error}</p> : null}
      </div>
    </Modal>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={styles.field}><span>{label}</span>{children}</label>;
}
const styles = {
  content: { display: "grid", gap: 12, paddingBottom: 12 },
  scope: { color: COLOR.TEXT.PRIMARY, fontSize: 14, margin: 0, lineHeight: 1.5 },
  help: { color: COLOR.TEXT.SECONDARY, fontSize: 13, margin: 0, lineHeight: 1.5 },
  fields: { display: "grid", gap: 12, border: 0, padding: 0, margin: 0, minWidth: 0 },
  dates: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, color: COLOR.TEXT.SECONDARY },
  input: { width: "100%", minHeight: 42, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, color: COLOR.TEXT.PRIMARY, background: COLOR.INPUT.PRIMARY.BACKGROUND, textAlign: "left" as const },
  error: { color: COLOR.ICON.DANGER, margin: 0, fontSize: 13 },
} as const;
