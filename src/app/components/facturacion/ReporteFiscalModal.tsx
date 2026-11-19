"use client";

import { useState, type ReactNode } from "react";
import Modal from "@/app/components/ui/Modal";
import Calendar from "@/app/components/ui/Calendar";
import Dropdown from "@/app/components/ui/Dropdown";
import IconInput from "@/app/components/ui/IconInput";
import { parseCalendarDate, toISODateAppTimeZone } from "@/lib/fechas";
import { fiscalFilename, parseFiscalFilters } from "@/lib/facturacion/reporteFiscal";
import { comprasFiscalFilename, parseComprasFiscalFilters } from "@/lib/comprobantesRecibidos/reporteFiscal";
import { COLOR } from "@/theme/theme";

type ReporteTipo = "VENTAS" | "COMPRAS";
type Filters = {
  desde: string;
  hasta: string;
  format: "csv" | "xlsx";
  documentoTipo: string;
  origenTipo: string;
  cuitEmisor: string;
  tipoOperacionCompra: string;
};

const FORMATO_OPTIONS = [
  { value: "xlsx", label: "Excel (.xlsx), resumen y detalle" },
  { value: "csv", label: "CSV (.csv), detalle y totales" },
];

function currentMonth() {
  const today = toISODateAppTimeZone();
  const { year, month } = parseCalendarDate(today)!;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { desde: `${today.slice(0, 7)}-01`, hasta: `${today.slice(0, 7)}-${lastDay}` };
}

/** Mounted on open so each request starts with independent, current GMT-3 defaults. */
export default function ReporteFiscalModal({
  onClose,
  canViewVentas = true,
  canViewCompras = true,
}: {
  onClose: () => void;
  canViewVentas?: boolean;
  canViewCompras?: boolean;
}) {
  const [reporteTipo, setReporteTipo] = useState<ReporteTipo>(() => canViewVentas ? "VENTAS" : "COMPRAS");
  const [filters, setFilters] = useState<Filters>(() => ({
    ...currentMonth(),
    format: "xlsx",
    documentoTipo: "",
    origenTipo: "",
    cuitEmisor: "",
    tipoOperacionCompra: "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isCompras = reporteTipo === "COMPRAS";
  const update = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => setFilters((current) => ({ ...current, [key]: value }));

  async function download() {
    setError("");
    let requestUrl = "";
    let filename = "";

    try {
      if (isCompras) {
        const query = new URLSearchParams({ format: filters.format, desde: filters.desde, hasta: filters.hasta });
        if (filters.tipoOperacionCompra) query.set("tipoOperacion", filters.tipoOperacionCompra);
        if (filters.cuitEmisor) query.set("cuitEmisor", filters.cuitEmisor);
        const validated = parseComprasFiscalFilters(query);
        requestUrl = `/api/comprobantes-recibidos/export?${query}`;
        filename = comprasFiscalFilename(validated);
      } else {
        const query = new URLSearchParams({
          reporte: "fiscal",
          format: filters.format,
          desde: filters.desde,
          hasta: filters.hasta,
          documentoTipo: filters.documentoTipo,
          origenTipo: filters.origenTipo,
          cuitEmisor: filters.cuitEmisor,
        });
        const validated = parseFiscalFilters(query);
        requestUrl = `/api/facturas/export?${query}`;
        filename = fiscalFilename(validated);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisá los filtros");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(requestUrl, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo generar el reporte fiscal");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Give the browser time to start consuming the download before releasing the URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el reporte");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      title={`Reporte fiscal de ${isCompras ? "compras" : "ventas"}`}
      onClose={onClose}
      onSubmit={download}
      submitText="Descargar reporte"
      submittingText="Generando reporte…"
      submitting={submitting}
    >
      <div style={styles.content}>
        <div style={styles.modeField}>
          <span style={styles.fieldLabel}>Tipo de comprobantes</span>
          <div role="group" aria-label="Tipo de comprobantes" style={styles.segmentedGroup}>
            {canViewVentas ? (
              <button
                type="button"
                aria-pressed={!isCompras}
                disabled={submitting}
                onClick={() => setReporteTipo("VENTAS")}
                style={{ ...styles.segmentedButton, ...(!isCompras ? styles.segmentedButtonSelected : {}) }}
                data-testid="reporte-fiscal-tipo-ventas"
              >
                Facturas de ventas
              </button>
            ) : null}
            {canViewCompras ? (
              <button
                type="button"
                aria-pressed={isCompras}
                disabled={submitting}
                onClick={() => setReporteTipo("COMPRAS")}
                style={{ ...styles.segmentedButton, ...(isCompras ? styles.segmentedButtonSelected : {}) }}
                data-testid="reporte-fiscal-tipo-compras"
              >
                Facturas de compras
              </button>
            ) : null}
          </div>
        </div>

        {isCompras ? (
          <p style={styles.scope}>
            <strong>Documentos recibidos</strong><br />
            Facturas A, B y C y retenciones asociadas a compras y gastos. El período inclusivo usa la fecha del documento; los importes se expresan en pesos argentinos, sin conversión. Las retenciones aparecen en una sección separada.
          </p>
        ) : (
          <p style={styles.scope}>
            <strong>Comprobantes autorizados</strong><br />
            Se incluyen únicamente los del ambiente configurado para facturación. Facturas, notas de crédito y débito de arreglos y ventas, incluidas las FCE. Período inclusivo por fecha del comprobante.
          </p>
        )}
        <p style={styles.help}>Este reporte usa sus propios filtros. CSV y Excel del listado descargan los filtros del listado.</p>

        <fieldset disabled={submitting} style={styles.fields}>
          <div style={styles.dates}>
            {(["desde", "hasta"] as const).map((key) => (
              <Field key={key} label={`Fecha ${key}`}>
                <Calendar
                  value={filters[key]}
                  onChange={(value) => update(key, value)}
                  disabled={submitting}
                  ariaLabel={`Fecha ${key} del reporte`}
                  dataTestId={`reporte-fiscal-${key}`}
                />
              </Field>
            ))}
          </div>

          {isCompras ? (
            <>
              <Field label="Tipo de operación">
                <Dropdown
                  ariaLabel="Tipo de operación"
                  dataTestId="reporte-fiscal-operacion"
                  value={filters.tipoOperacionCompra}
                  onChange={(value) => update("tipoOperacionCompra", value)}
                  disabled={submitting}
                  style={styles.dropdown}
                  options={[
                    { value: "", label: "Compras y gastos" },
                    { value: "COMPRA", label: "Compras" },
                    { value: "GASTO", label: "Gastos" },
                  ]}
                />
              </Field>
              <Field label="CUIT emisor / proveedor (opcional)">
                <IconInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  placeholder="Todos los emisores"
                  value={filters.cuitEmisor}
                  aria-label="CUIT emisor / proveedor (opcional)"
                  data-testid="reporte-fiscal-cuit-compras"
                  disabled={submitting}
                  onChange={(event) => update("cuitEmisor", event.target.value.replace(/\D/g, "").slice(0, 11))}
                  wrapperStyle={styles.inputWrap}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Documento del reporte">
                <Dropdown
                  ariaLabel="Documento del reporte"
                  dataTestId="reporte-fiscal-documento"
                  value={filters.documentoTipo}
                  onChange={(value) => update("documentoTipo", value)}
                  disabled={submitting}
                  style={styles.dropdown}
                  options={[
                    { value: "", label: "Todos los documentos" },
                    { value: "FACTURA", label: "Facturas" },
                    { value: "NOTA_CREDITO", label: "Notas de crédito" },
                    { value: "NOTA_DEBITO", label: "Notas de débito" },
                  ]}
                />
              </Field>
              <Field label="Origen del reporte">
                <Dropdown
                  ariaLabel="Origen del reporte"
                  dataTestId="reporte-fiscal-origen"
                  value={filters.origenTipo}
                  onChange={(value) => update("origenTipo", value)}
                  disabled={submitting}
                  style={styles.dropdown}
                  options={[
                    { value: "", label: "Todos los orígenes" },
                    { value: "ARREGLO", label: "Arreglos" },
                    { value: "VENTA", label: "Ventas" },
                  ]}
                />
              </Field>
              <Field label="CUIT emisor (opcional)">
                <IconInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  placeholder="Todos los emisores"
                  value={filters.cuitEmisor}
                  aria-label="CUIT emisor (opcional)"
                  data-testid="reporte-fiscal-cuit-ventas"
                  disabled={submitting}
                  onChange={(event) => update("cuitEmisor", event.target.value.replace(/\D/g, "").slice(0, 11))}
                  wrapperStyle={styles.inputWrap}
                />
              </Field>
            </>
          )}

          <Field label="Formato del reporte">
            <Dropdown
              ariaLabel="Formato del reporte"
              dataTestId="reporte-fiscal-formato"
              value={filters.format}
              onChange={(value) => update("format", value as Filters["format"])}
              disabled={submitting}
              style={styles.dropdown}
              options={FORMATO_OPTIONS}
            />
          </Field>
        </fieldset>
        {isCompras ? (
          <p style={styles.help}>Las bases e IVA discriminado se toman del desglose confirmado de cada factura A. Los importes no informados quedan vacíos.</p>
        ) : (
          <p style={styles.help}>Los desgloses desconocidos quedan vacíos y se explican en Observaciones.</p>
        )}
        {error ? <p role="alert" style={styles.error}>{error}</p> : null}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={styles.field}><span style={styles.fieldLabel}>{label}</span>{children}</label>;
}

const styles = {
  content: { display: "grid", gap: 12, paddingBottom: 12 },
  modeField: { display: "grid", gap: 6 },
  fieldLabel: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  segmentedGroup: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: 3,
    borderRadius: 10,
    gap: 3,
    flexWrap: "wrap" as const,
  },
  segmentedButton: {
    border: 0,
    borderRadius: 8,
    padding: "8px 14px",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  segmentedButtonSelected: {
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  scope: { color: COLOR.TEXT.PRIMARY, fontSize: 14, margin: 0, lineHeight: 1.5 },
  help: { color: COLOR.TEXT.SECONDARY, fontSize: 13, margin: 0, lineHeight: 1.5 },
  fields: { display: "grid", gap: 12, border: 0, padding: 0, margin: 0, minWidth: 0 },
  dates: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0 },
  dropdown: { width: "100%", height: 42, minWidth: 0 },
  inputWrap: { width: "100%", boxSizing: "border-box" as const },
  error: { color: COLOR.ICON.DANGER, margin: 0, fontSize: 13 },
} as const;
