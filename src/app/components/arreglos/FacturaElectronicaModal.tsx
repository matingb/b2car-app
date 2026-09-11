"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Download, ReceiptText, Settings2 } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import Button from "@/app/components/ui/Button";
import Dropdown from "@/app/components/ui/Dropdown";
import IconInput from "@/app/components/ui/IconInput";
import {
  normalizeArcaCuit,
  useArcaInscriptionLookup,
  type ArcaInscriptionLookupState,
} from "@/app/hooks/useArcaInscriptionLookup";
import { COLOR } from "@/theme/theme";
import {
  CONDICIONES_IVA_RECEPTOR,
  TIPOS_DOCUMENTO_FISCAL,
  type FacturaElectronicaResumen,
  type FacturaFechaInput,
  type FacturacionPreflight,
  type PerfilFiscalCliente,
} from "@/lib/facturacion/types";
import {
  determineVoucher,
  validateReceiverIdentification,
} from "@/lib/facturacion/arcaPayload";
import {
  documentTypesForInvoiceCondition,
  responsableInscriptoNeedsCuit,
} from "./facturaReceptorRules";

type Props = {
  open: boolean;
  arregloId?: string;
  operacionId?: string;
  onClose: () => void;
  onAuthorized: (factura: FacturaElectronicaResumen) => void;
};

type FiscalDraft = {
  tipoDocumento: string;
  numeroDocumento: string;
  condicionIvaReceptorId: string;
};

function defaultDraft(receptor: PerfilFiscalCliente): FiscalDraft {
  const condicionIvaReceptorId = receptor.condicionIvaReceptorId ?? 5;
  const requiresCuit = condicionIvaReceptorId !== 5;
  return {
    tipoDocumento: String(requiresCuit ? 80 : receptor.tipoDocumento ?? 99),
    numeroDocumento: requiresCuit && receptor.tipoDocumento !== 80 ? "" : receptor.numeroDocumento ?? "",
    condicionIvaReceptorId: String(condicionIvaReceptorId),
  };
}

const ivaOptions = CONDICIONES_IVA_RECEPTOR.map((condicion) => ({ value: String(condicion.id), label: condicion.label }));
const condicionVentaOptions = [
  { value: "CONTADO", label: "Contado" },
  { value: "TARJETA DE DEBITO", label: "Tarjeta de débito" },
  { value: "TARJETA DE CREDITO", label: "Tarjeta de crédito" },
  { value: "CUENTA CORRIENTE", label: "Cuenta corriente" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TRANSFERENCIA BANCARIA", label: "Transferencia bancaria" },
  { value: "OTRA", label: "Otra" },
];

function ArcaInscriptionInvoiceFeedback({
  lookup,
  onRetry,
}: {
  lookup: ArcaInscriptionLookupState;
  onRetry: () => void;
}) {
  if (lookup.status === "IDLE") return null;
  if (lookup.status === "LOADING") {
    return <span style={styles.lookupPending}>Verificando la condición IVA del receptor en ARCA...</span>;
  }
  if (lookup.status === "FOUND") {
    return (
      <div style={styles.lookupFound} role="status">
        <strong>Condición IVA verificada: {lookup.condition.condicionIvaLabel}</strong>
        <span>CUIT {lookup.condition.cuit} · Constancia de Inscripción ARCA</span>
      </div>
    );
  }
  if (lookup.status === "UNDETERMINED") {
    return (
      <div style={styles.lookupError} role="status">
        <span>{lookup.message}</span>
        <button type="button" style={styles.lookupRetry} onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  return (
    <div style={styles.lookupError} role="status">
      <span>{lookup.message}</span>
      <button type="button" style={styles.lookupRetry} onClick={onRetry}>Reintentar</button>
    </div>
  );
}

export default function FacturaElectronicaModal({ open, arregloId, operacionId, onClose, onAuthorized }: Props) {
  const router = useRouter();
  const [preflight, setPreflight] = useState<FacturacionPreflight | null>(null);
  const [factura, setFactura] = useState<FacturaElectronicaResumen | null>(null);
  const [receptor, setReceptor] = useState<FiscalDraft>({ tipoDocumento: "99", numeroDocumento: "", condicionIvaReceptorId: "5" });
  const [condicionVenta, setCondicionVenta] = useState("CONTADO");
  const [fechas, setFechas] = useState<FacturaFechaInput>({ fechaComprobante: "" });
  const [automaticConditionCuit, setAutomaticConditionCuit] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const endpoint = operacionId ? `/api/operaciones/${operacionId}/factura` : `/api/arreglos/${arregloId}/factura`;
  const entidadCerrada = operacionId ? "la venta quedará cerrada" : "el arreglo quedará cerrado";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreflight(null);
    setFactura(null);
    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo preparar la factura electrónica");
        if (cancelled) return;
        const data = body.data as { factura: FacturaElectronicaResumen | null; preflight: FacturacionPreflight };
        setPreflight(data.preflight);
        setFactura(data.factura);
        setReceptor(defaultDraft(data.preflight.receptor));
        setAutomaticConditionCuit(null);
        setCondicionVenta("CONTADO");
        setFechas(data.preflight.fechasDefault);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo preparar la factura electrónica");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, open]);

  const canRetry = factura?.estado === "RECHAZADA";
  const needsConfiguration = Boolean(preflight && !preflight.configuracionCompleta);
  const isServiceConcept = preflight?.concepto === 2 || preflight?.concepto === 3;
  const receptorCondition = receptor.condicionIvaReceptorId
    ? Number(receptor.condicionIvaReceptorId) as PerfilFiscalCliente["condicionIvaReceptorId"]
    : null;
  const receiverIsConsumerFinal = receptorCondition === 5;
  const receiverIsResponsibleInscripto = receptorCondition === 1;
  const responsibleInscriptoDocumentInvalid = responsableInscriptoNeedsCuit(
    receptorCondition,
    receptor.tipoDocumento,
  );
  const lookupCuit = receptor.tipoDocumento === "80"
    ? normalizeArcaCuit(receptor.numeroDocumento)
    : "";
  const arcaInscriptionLookup = useArcaInscriptionLookup({
    enabled: open && receptor.tipoDocumento === "80",
    cuit: lookupCuit,
  });
  const verifiedArcaCondition = arcaInscriptionLookup.status === "FOUND"
    ? arcaInscriptionLookup.condition
    : null;

  useEffect(() => {
    if (!automaticConditionCuit || automaticConditionCuit === lookupCuit) return;
    setAutomaticConditionCuit(null);
    setReceptor((previous) => ({ ...previous, condicionIvaReceptorId: "" }));
  }, [automaticConditionCuit, lookupCuit]);

  useEffect(() => {
    if (!verifiedArcaCondition) return;
    setReceptor((previous) => {
      if (
        previous.tipoDocumento !== "80"
        || normalizeArcaCuit(previous.numeroDocumento) !== verifiedArcaCondition.cuit
      ) {
        return previous;
      }
      return {
        ...previous,
        condicionIvaReceptorId: String(verifiedArcaCondition.condicionIvaReceptorId),
      };
    });
    setAutomaticConditionCuit(verifiedArcaCondition.cuit);
  }, [verifiedArcaCondition]);

  const voucherPreview = useMemo(() => {
    if (!preflight?.emisor || receptorCondition === null) return null;
    return determineVoucher(
      preflight.emisor.condicionIvaEmisor,
      receptorCondition,
    );
  }, [preflight?.emisor, receptorCondition]);
  const documentOptions = useMemo(
    () => documentTypesForInvoiceCondition(receptorCondition).map((tipo) => ({
      value: String(tipo),
      label: TIPOS_DOCUMENTO_FISCAL.find((option) => option.id === tipo)?.label ?? "CUIT",
    })),
    [receptorCondition],
  );
  const receiverIdentificationError = useMemo(() => {
    if (!preflight) return null;
    if (receptorCondition === null) return "Verificá o seleccioná la condición IVA del receptor.";
    if (!voucherPreview) return null;
    try {
      validateReceiverIdentification({
        tipoDocumento: Number(receptor.tipoDocumento) as PerfilFiscalCliente["tipoDocumento"],
        numeroDocumento: receptor.numeroDocumento,
        condicionIvaReceptorId: receptorCondition,
      }, voucherPreview.clase);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : "La identificación del receptor no es válida";
    }
  }, [preflight, receptor.tipoDocumento, receptor.numeroDocumento, receptorCondition, voucherPreview]);
  const canSubmit = Boolean(
    !needsConfiguration
    && preflight
    && receptorCondition !== null
    && !receiverIdentificationError
    && !responsibleInscriptoDocumentInvalid
    && (preflight.puedeEmitir || canRetry)
    && factura?.estado !== "AUTORIZADA"
    && factura?.estado !== "INCIERTA",
  );
  const submitText = needsConfiguration
    ? "Configurar facturación"
    : canRetry ? "Reintentar emisión" : `Emitir ${voucherPreview ? `Factura ${voucherPreview.clase}` : "factura"}`;

  const invoiceLabel = useMemo(() => {
    if (!factura?.numeroComprobante) return "";
    return `${String(preflight?.emisor?.puntoVenta ?? 0).padStart(5, "0")}-${String(factura.numeroComprobante).padStart(8, "0")}`;
  }, [factura?.numeroComprobante, preflight?.emisor?.puntoVenta]);

  const handleSubmit = async () => {
    if (needsConfiguration) {
      onClose();
      router.push("/configuracion");
      return;
    }
    if (!preflight || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          condicionVenta,
          receptor: {
            tipoDocumento: Number(receptor.tipoDocumento),
            numeroDocumento: receptor.numeroDocumento,
            condicionIvaReceptorId: Number(receptor.condicionIvaReceptorId),
          },
          fechas,
        }),
      });
      const body = await response.json();
      if (body.data) setFactura(body.data as FacturaElectronicaResumen);
      if (!response.ok) throw new Error(body.error || "La emisión fiscal no fue autorizada");
      const issued = body.data as FacturaElectronicaResumen;
      setFactura(issued);
      onAuthorized(issued);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La emisión fiscal no fue autorizada");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = () => {
    if (!factura?.id) return;
    window.location.assign(`/api/facturas/${factura.id}/pdf`);
  };

  return (
    <Modal
      open={open}
      title={needsConfiguration ? "Facturación electrónica sin configurar" : "Facturación electrónica"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={submitText}
      submitting={submitting}
      disabledSubmit={loading || (!needsConfiguration && !canSubmit)}
      showCloseButton
      modalStyle={styles.modal}
      footerStyle={styles.footer}
      modalError={error ? { titulo: "No se pudo emitir la factura", descripcion: error } : null}
    >
      {loading ? <p style={styles.muted}>Preparando datos fiscales…</p> : null}
      {!loading && needsConfiguration ? (
        <div style={styles.configurationContent}>
          <div style={styles.configurationIcon}><Settings2 size={24} /></div>
          <div style={styles.configurationText}>
            <strong>Antes de emitir un comprobante, configurá la facturación electrónica.</strong>
            <span>
              Completá los datos fiscales y cargá el certificado junto con su clave privada para poder emitir con ARCA.
            </span>
          </div>
        </div>
      ) : null}
      {!loading && preflight && !needsConfiguration ? (
        <div style={styles.content}>
          {factura?.estado === "AUTORIZADA" ? (
            <div style={styles.authorized}>
              <strong>Factura {factura.claseComprobante} autorizada: {invoiceLabel}</strong>
              <span>CAE {factura.cae ?? "-"} · vence {factura.caeVencimiento ?? "-"}</span>
              <Button icon={<Download size={16} />} text="Descargar PDF" onClick={downloadPdf} hideTextOnMobile={false} />
            </div>
          ) : null}
          <section style={styles.summary} aria-label="Resumen fiscal">
            <div style={styles.summaryItem}>
              <div style={styles.summaryIcon}><ReceiptText size={17} /></div>
              <div style={styles.summaryText}>
                <span style={styles.label}>Tipo de comprobante</span>
                <strong>Factura {voucherPreview?.clase ?? preflight.claseComprobante} (tipo {voucherPreview?.tipo ?? preflight.tipoComprobante})</strong>
                <span style={styles.summaryDetail}>Concepto {preflight.concepto}: {preflight.concepto === 1 ? "productos" : preflight.concepto === 2 ? "servicios" : "productos y servicios"}</span>
              </div>
            </div>
            <div style={{ ...styles.summaryItem, ...styles.emitterSummary }}>
              <div style={styles.summaryText}>
                <span style={styles.label}>Datos del emisor</span>
                <strong>{preflight.emisor?.razonSocial ?? "Configuración pendiente"}</strong>
                <span style={styles.summaryDetail}>{preflight.emisor?.cuit ?? ""} · Punto de venta {preflight.emisor?.puntoVenta ?? "-"}</span>
              </div>
            </div>
          </section>
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Identificación del receptor</div>
            <div style={styles.recipientGrid}>
              <label style={styles.field}>Tipo de documento
                <Dropdown
                  id="factura-tipo-documento"
                  options={documentOptions}
                  value={receptor.tipoDocumento}
                  onChange={(value) => {
                    setAutomaticConditionCuit(null);
                    setReceptor((previous) => ({
                      ...previous,
                      tipoDocumento: value,
                      ...(value === "99" ? { numeroDocumento: "", condicionIvaReceptorId: "5" } : {}),
                    }));
                  }}
                  disabled={!receiverIsConsumerFinal && !receiverIsResponsibleInscripto}
                  style={styles.dropdown}
                  dataTestId="factura-tipo-documento"
                />
              {responsibleInscriptoDocumentInvalid ? (
                <span style={styles.validationError} role="alert">
                  Para un receptor Responsable Inscripto debe seleccionarse CUIT.
                </span>
              ) : null}
              </label>
              <label style={styles.field}>Número de documento
                <IconInput
                  icon={null}
                  inputMode="numeric"
                  value={receptor.numeroDocumento}
                  disabled={receptor.tipoDocumento === "99"}
                  placeholder={receptor.tipoDocumento === "99" ? "No requerido" : receptor.tipoDocumento === "80" ? "Ej: 20123456786" : undefined}
                  wrapperStyle={styles.inputWrapper}
                  data-testid="factura-numero-documento"
                  onChange={(event) => setReceptor((previous) => ({ ...previous, numeroDocumento: event.target.value }))}
                />
                {receiverIdentificationError ? <span style={styles.validationError}>{receiverIdentificationError}</span> : null}
              </label>
            </div>
            <ArcaInscriptionInvoiceFeedback
              lookup={arcaInscriptionLookup}
              onRetry={arcaInscriptionLookup.retry}
            />
            <span style={styles.recipientReference}>
              Cliente seleccionado: <strong style={styles.recipientName}>{preflight.receptor.nombre}</strong>. La consulta verifica la condición IVA para este comprobante y no modifica su ficha.
            </span>
          </section>
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Condiciones de la factura</div>
            <div style={styles.conditionsGrid}>
              <label style={styles.field}>Condición IVA
                <Dropdown
                  id="factura-condicion-iva"
                  options={ivaOptions}
                  value={receptor.condicionIvaReceptorId}
                  onChange={(value) => {
                    setAutomaticConditionCuit(null);
                    setReceptor((previous) => {
                      const requiresCuit = Number(value) !== 5;
                      return {
                        ...previous,
                        condicionIvaReceptorId: value,
                        ...(requiresCuit ? {
                          tipoDocumento: "80",
                          numeroDocumento: previous.tipoDocumento === "80" ? previous.numeroDocumento : "",
                        } : {}),
                      };
                    });
                  }}
                  style={styles.dropdown}
                  dataTestId="factura-condicion-iva"
                />
              </label>
              <label style={styles.field}>Condición de venta
                <Dropdown
                  id="factura-condicion-venta"
                  options={condicionVentaOptions}
                  value={condicionVenta}
                  onChange={setCondicionVenta}
                  style={styles.dropdown}
                  dataTestId="factura-condicion-venta"
                />
              </label>
            </div>
          </section>
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Fechas aplicables</div>
            <div style={styles.dateGrid}>
              <label style={styles.field}>Comprobante
                <IconInput
                  icon={null}
                  type="date"
                  value={fechas.fechaComprobante}
                  wrapperStyle={styles.inputWrapper}
                  onChange={(event) => setFechas((previous) => ({ ...previous, fechaComprobante: event.target.value }))}
                />
              </label>
              {isServiceConcept ? <>
                <label style={styles.field}>Vencimiento
                  <IconInput
                    icon={null}
                    type="date"
                    value={fechas.fechaVencimientoPago ?? ""}
                    wrapperStyle={styles.inputWrapper}
                    onChange={(event) => setFechas((previous) => ({ ...previous, fechaVencimientoPago: event.target.value }))}
                  />
                </label>
                <label style={styles.field}>Servicio desde
                  <IconInput
                    icon={null}
                    type="date"
                    value={fechas.fechaServicioDesde ?? ""}
                    wrapperStyle={styles.inputWrapper}
                    onChange={(event) => setFechas((previous) => ({ ...previous, fechaServicioDesde: event.target.value }))}
                  />
                </label>
                <label style={styles.field}>Servicio hasta
                  <IconInput
                    icon={null}
                    type="date"
                    value={fechas.fechaServicioHasta ?? ""}
                    wrapperStyle={styles.inputWrapper}
                    onChange={(event) => setFechas((previous) => ({ ...previous, fechaServicioHasta: event.target.value }))}
                  />
                </label>
              </> : null}
            </div>
          </section>
          <section style={styles.detail} aria-label="Detalle a facturar">
            <div style={styles.lines}>
              {preflight.lineas.map((linea) => <div style={styles.line} key={`${linea.origen}-${linea.ordinal}`}><span>{linea.descripcion}{linea.codigo ? ` (${linea.codigo})` : ""} × {linea.cantidad}</span><strong>{linea.subtotal.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</strong></div>)}
            </div>
            <div style={styles.total}><span>Total a facturar</span><strong style={styles.totalAmount}>{preflight.total.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</strong></div>
          </section>
          {preflight.mensaje && factura?.estado !== "RECHAZADA" ? <div style={styles.warning}><CircleAlert size={16} /><span>{preflight.mensaje}</span></div> : null}
          {factura?.estado === "INCIERTA" ? <div style={styles.warning}><CircleAlert size={16} /><span>La emisión quedó incierta. No se asignará otro número hasta reconciliar el comprobante candidato.</span></div> : null}
          {factura?.estado !== "AUTORIZADA" ? <div style={styles.immutability}><CircleAlert size={16} /><span>Una vez emitida la factura, {entidadCerrada} y no admitirá ningún tipo de modificación.</span></div> : null}
        </div>
      ) : null}
    </Modal>
  );
}

const styles = {
  modal: {
    width: "min(1020px, 96vw)",
    maxHeight: "90dvh",
    overflowY: "auto" as const,
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "18px 18px 0",
  },
  content: { display: "flex", flexDirection: "column" as const, gap: 16 },
  configurationContent: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "8px 0 10px",
  },
  configurationIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 10,
    flexShrink: 0,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  configurationText: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    lineHeight: 1.5,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 0,
    padding: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  summaryItem: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  emitterSummary: { borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`, paddingLeft: 16, marginLeft: 16 },
  summaryIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    width: 30,
    height: 30,
    borderRadius: 8,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  summaryText: { display: "flex", flexDirection: "column" as const, gap: 2, minWidth: 0 },
  summaryDetail: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingBottom: 10,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
  },
  recipientName: { color: COLOR.ACCENT.PRIMARY },
  label: { display: "block", fontSize: 11, color: COLOR.TEXT.TERTIARY, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  muted: { color: COLOR.TEXT.SECONDARY, fontSize: 13, lineHeight: 1.4 },
  recipientGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(145px, 0.7fr) minmax(190px, 1fr)",
    gap: 16,
  },
  conditionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  dateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500, minWidth: 0 },
  dropdown: { width: "100%", height: 42 },
  inputWrapper: { width: "100%" },
  validationError: { color: COLOR.SEMANTIC.DANGER, fontSize: 12, lineHeight: 1.35 },
  recipientReference: { color: COLOR.TEXT.TERTIARY, fontSize: 12, lineHeight: 1.4 },
  lookupPending: { color: COLOR.TEXT.TERTIARY, fontSize: 12 },
  lookupError: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 12,
    lineHeight: 1.4,
  },
  lookupRetry: {
    flex: "0 0 auto",
    border: 0,
    padding: 0,
    background: "transparent",
    color: COLOR.ACCENT.PRIMARY,
    cursor: "pointer",
    font: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
  },
  lookupFound: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
    padding: "10px 12px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    lineHeight: 1.35,
  },
  lookupCandidateLabel: { display: "flex", flexDirection: "column" as const, gap: 5, fontSize: 12 },
  lookupCandidateSelect: {
    width: "100%",
    height: 38,
    padding: "7px 9px",
    borderRadius: 6,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
  },
  detail: { border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: 14, background: COLOR.BACKGROUND.SUBTLE },
  lines: { display: "flex", flexDirection: "column" as const, gap: 8 },
  line: { display: "flex", justifyContent: "space-between", gap: 12, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  total: { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, marginTop: 12, paddingTop: 12, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  totalAmount: { color: COLOR.ACCENT.PRIMARY, fontSize: 18 },
  warning: { display: "flex", alignItems: "flex-start", gap: 8, background: COLOR.BACKGROUND.ALERT_TINT, border: `1px solid ${COLOR.SEMANTIC.ALERT}`, color: COLOR.SEMANTIC.WARNING, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.4 },
  immutability: { display: "flex", alignItems: "flex-start", gap: 8, background: COLOR.BACKGROUND.ALERT_TINT, border: `1px solid ${COLOR.SEMANTIC.ALERT}`, color: COLOR.SEMANTIC.WARNING, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.4 },
  footer: { margin: "20px -18px 0", padding: "16px 18px 18px", borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, gap: 12 },
  authorized: { display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 8, background: COLOR.BACKGROUND.SUCCESS_TINT, color: COLOR.SEMANTIC.SUCCESS, padding: 14, borderRadius: 8 },
} as const;
