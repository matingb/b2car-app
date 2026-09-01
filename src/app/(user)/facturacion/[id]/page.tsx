"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, RefreshCw, ReceiptText, RotateCcw, TrendingUp } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import {
  FACTURA_ESTADO_LABEL,
  comprobanteLabel,
  type FacturaElectronicaDetalle,
} from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";

function money(value: number) { return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" }); }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat("es-AR").format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "-"; }
function value(record: Record<string, unknown>, key: string) { return String(record[key] ?? "-"); }

export default function FacturaDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<FacturaElectronicaDetalle | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<"NOTA_CREDITO" | "NOTA_DEBITO" | null>(null);
  const [noteAmount, setNoteAmount] = useState("");
  const [noteReason, setNoteReason] = useState("");
  const [noteIdempotencyKey, setNoteIdempotencyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/facturas/${params.id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo cargar el comprobante");
      setInvoice(body.data);
      setCanManage(body.canManage === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el comprobante");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const reconcile = async () => {
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/facturas/${params.id}/reconciliar`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo reconciliar");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo reconciliar"); }
    finally { setWorking(false); }
  };

  const issueNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteOpen || !noteIdempotencyKey) return;
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/facturas/${params.id}/notas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: noteOpen, importe: Number(noteAmount), motivo: noteReason, idempotencyKey: noteIdempotencyKey }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo emitir la nota");
      setNoteOpen(null); setNoteAmount(""); setNoteReason(""); setNoteIdempotencyKey(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo emitir la nota"); }
    finally { setWorking(false); }
  };

  if (loading) return <><ScreenHeader title="Detalle del comprobante" /><ListSkeleton rows={7} /></>;
  if (!invoice) return <><ScreenHeader title="Detalle del comprobante" />{error ? <div style={styles.error}>{error}</div> : null}</>;

  const number = invoice.numeroComprobante
    ? `${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante).padStart(8, "0")}` : "Sin número";

  const openNote = (type: "NOTA_CREDITO" | "NOTA_DEBITO") => {
    setNoteOpen(type);
    setNoteIdempotencyKey(crypto.randomUUID());
    setError(null);
  };

  const closeNote = () => {
    setNoteOpen(null);
    setNoteAmount("");
    setNoteReason("");
    setNoteIdempotencyKey(null);
  };

  return (
    <div>
      <Link href="/facturacion" style={styles.back}><ArrowLeft size={16} /> Volver a facturas</Link>
      <div style={styles.headerRow}>
        <ScreenHeader title={`${comprobanteLabel(invoice.documentoTipo, invoice.claseComprobante)} ${number}`} subtitle={`${invoice.receptorNombre} · ${date(invoice.fechaComprobante)}`} />
        <div style={styles.actions}>
          {invoice.estado === "AUTORIZADA" ? <Button text="Descargar PDF" icon={<Download size={17} />} onClick={() => window.location.assign(`/api/facturas/${invoice.id}/pdf`)} hideTextOnMobile={false} /> : null}
          {canManage && (invoice.estado === "INCIERTA" || invoice.estado === "ENVIANDO") ? <Button text={working ? "Consultando…" : "Reconciliar ARCA"} icon={<RefreshCw size={17} />} outline disabled={working} onClick={reconcile} hideTextOnMobile={false} /> : null}
        </div>
      </div>
      {error ? <div role="alert" style={styles.error}>{error}</div> : null}

      <div style={styles.summaryGrid}>
        <Metric label="Estado" value={FACTURA_ESTADO_LABEL[invoice.estado]} />
        <Metric label="Total" value={money(invoice.total)} />
        <Metric label="Ambiente" value={invoice.ambiente === "PRODUCCION" ? "Producción" : "Homologación"} />
        <Metric label="CAE" value={invoice.cae ?? "Pendiente"} mono />
      </div>

      <div style={styles.twoColumns}>
        <Card style={styles.card}><h2 style={styles.cardTitle}>Emisor</h2><Info label="Razón social" value={value(invoice.emisorSnapshot, "razonSocial")} /><Info label="CUIT" value={value(invoice.emisorSnapshot, "cuit")} /><Info label="Condición IVA" value={value(invoice.emisorSnapshot, "condicionIva")} /><Info label="Domicilio" value={value(invoice.emisorSnapshot, "domicilio")} /></Card>
        <Card style={styles.card}><h2 style={styles.cardTitle}>Receptor</h2><Info label="Nombre / razón social" value={invoice.receptorNombre} /><Info label="Documento" value={invoice.receptorDocumento ?? "Sin identificar"} /><Info label="Domicilio" value={value(invoice.receptorSnapshot, "domicilio")} /><Info label="Condición de venta" value={invoice.condicionVenta} /></Card>
      </div>

      <Card style={styles.card}>
        <h2 style={styles.cardTitle}>Detalle facturado</h2>
        <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Descripción</th><th style={styles.thRight}>Cantidad</th><th style={styles.thRight}>Unitario</th><th style={styles.thRight}>IVA</th><th style={styles.thRight}>Subtotal</th></tr></thead><tbody>
          {invoice.lineas.map((line) => <tr key={`${line.ordinal}-${line.descripcion}`}><td style={styles.td}>{line.codigo ?? "-"}</td><td style={styles.td}>{line.descripcion}</td><td style={styles.tdRight}>{line.cantidad}</td><td style={styles.tdRight}>{money(line.importeUnitario)}</td><td style={styles.tdRight}>{line.ivaAlicuota ? `${line.ivaAlicuota}%` : "-"}</td><td style={styles.tdRight}><strong>{money(line.subtotal)}</strong></td></tr>)}
        </tbody></table></div>
        <div style={styles.totals}><Info label="Neto gravado" value={money(invoice.totales.netoGravado)} /><Info label="IVA" value={money(invoice.totales.iva)} /><Info label="Exento / no gravado" value={money(invoice.totales.exento + invoice.totales.noGravado)} /><Info label="Total" value={money(invoice.total)} strong /></div>
      </Card>

      {invoice.documentoAsociado || invoice.documentosAjuste.length ? <Card style={styles.card}><h2 style={styles.cardTitle}>Documentos asociados</h2>{invoice.documentoAsociado ? <DocumentLink invoice={invoice.documentoAsociado} /> : null}{invoice.documentosAjuste.map((item) => <DocumentLink key={item.id} invoice={item} />)}</Card> : null}

      {canManage && invoice.estado === "AUTORIZADA" && invoice.documentoTipo === "FACTURA" ? (
        <Card style={styles.card}>
          <div style={styles.cardHeader}><div><h2 style={styles.cardTitle}>Ajustes fiscales</h2><p style={styles.muted}>Emití una nota asociada sin modificar la factura autorizada.</p></div><div style={styles.actions}><Button text="Nota de crédito" icon={<RotateCcw size={16} />} outline onClick={() => openNote("NOTA_CREDITO")} hideTextOnMobile={false} /><Button text="Nota de débito" icon={<TrendingUp size={16} />} outline onClick={() => openNote("NOTA_DEBITO")} hideTextOnMobile={false} /></div></div>
          {noteOpen ? <form onSubmit={issueNote} style={styles.noteForm}><label style={styles.field}>Importe<input required type="number" min="0.01" step="0.01" style={styles.input} value={noteAmount} onChange={(event) => setNoteAmount(event.target.value)} /></label><label style={{ ...styles.field, flex: "1 1 260px" }}>Motivo<input required maxLength={200} style={styles.input} value={noteReason} onChange={(event) => setNoteReason(event.target.value)} /></label><Button type="submit" text={working ? "Emitiendo…" : "Emitir nota"} disabled={working} hideTextOnMobile={false} /><Button type="button" text="Cancelar" outline onClick={closeNote} hideTextOnMobile={false} /></form> : null}
        </Card>
      ) : null}

      <Card style={styles.card}><h2 style={styles.cardTitle}>Trazabilidad de emisión</h2>{invoice.intentos.length ? <div style={styles.timeline}>{invoice.intentos.map((attempt) => <div style={styles.attempt} key={attempt.id}><span style={styles.attemptNumber}>#{attempt.numeroIntento}</span><div><strong>{attempt.estado}</strong><div style={styles.muted}>{attempt.errorMensaje ?? `Registrado ${date(attempt.createdAt)}`}</div></div></div>)}</div> : <p style={styles.muted}>Todavía no hay intentos registrados.</p>}</Card>
    </div>
  );
}

function Metric({ label, value: content, mono }: { label: string; value: string; mono?: boolean }) { return <Card style={styles.metric}><span>{label}</span><strong style={mono ? styles.mono : undefined}>{content}</strong></Card>; }
function Info({ label, value: content, strong }: { label: string; value: string; strong?: boolean }) { return <div style={styles.info}><span>{label}</span>{strong ? <strong>{content}</strong> : <span>{content}</span>}</div>; }
function DocumentLink({ invoice }: { invoice: FacturaElectronicaDetalle["documentosAjuste"][number] }) { return <Link href={`/facturacion/${invoice.id}`} style={styles.documentLink}><ReceiptText size={16} />{comprobanteLabel(invoice.documentoTipo, invoice.claseComprobante)} · {invoice.numeroComprobante ?? "sin número"}<strong>{money(invoice.total)}</strong></Link>; }

const styles = {
  back: { display: "inline-flex", alignItems: "center", gap: 6, color: COLOR.TEXT.SECONDARY, textDecoration: "none", fontSize: 13, marginBottom: 10 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" as const },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, margin: "16px 0" },
  metric: { display: "flex", flexDirection: "column" as const, gap: 5 },
  mono: { fontFamily: "monospace" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  card: { marginBottom: 12 }, cardTitle: { margin: "0 0 12px", fontSize: 18 },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const },
  info: { display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  tableWrap: { overflowX: "auto" as const }, table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 720 },
  th: { textAlign: "left" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` }, thRight: { textAlign: "right" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  td: { padding: "10px 8px", fontSize: 13, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` }, tdRight: { padding: "10px 8px", fontSize: 13, textAlign: "right" as const, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  totals: { marginLeft: "auto", marginTop: 12, maxWidth: 380 },
  timeline: { display: "flex", flexDirection: "column" as const, gap: 9 }, attempt: { display: "flex", gap: 10, alignItems: "flex-start" }, attemptNumber: { background: COLOR.BACKGROUND.SUBTLE, borderRadius: 8, padding: "5px 8px", fontFamily: "monospace", fontSize: 12 },
  muted: { color: COLOR.TEXT.SECONDARY, margin: 0, fontSize: 13 },
  documentLink: { display: "flex", alignItems: "center", gap: 8, color: COLOR.TEXT.PRIMARY, textDecoration: "none", padding: "9px 0", borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  noteForm: { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" as const, borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, marginTop: 14, paddingTop: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 5, color: COLOR.TEXT.SECONDARY, fontSize: 12 }, input: { height: 40, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 10px", background: COLOR.INPUT.PRIMARY.BACKGROUND, color: COLOR.TEXT.PRIMARY },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, margin: "12px 0" },
} as const;
