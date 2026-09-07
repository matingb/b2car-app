"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, TrendingUp } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import FacturaListItem from "@/app/components/facturacion/FacturaListItem";
import FacturaSummaryCard from "@/app/components/facturacion/FacturaSummaryCard";
import {
  type FacturaElectronicaDetalle,
} from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";

function money(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-AR").format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "-";
}

function value(record: Record<string, unknown>, key: string) {
  return String(record[key] ?? "-");
}

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

  useEffect(() => {
    void load();
  }, [load]);

  const reconcile = async () => {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/facturas/${params.id}/reconciliar`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo reconciliar");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo reconciliar");
    } finally {
      setWorking(false);
    }
  };

  const issueNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteOpen || !noteIdempotencyKey) return;

    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/facturas/${params.id}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: noteOpen,
          importe: Number(noteAmount),
          motivo: noteReason,
          idempotencyKey: noteIdempotencyKey,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo emitir la nota");
      closeNote();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo emitir la nota");
    } finally {
      setWorking(false);
    }
  };

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

  if (loading) {
    return <><ScreenHeader title="Facturas" breadcrumbs={["Detalle"]} hasBackButton /><ListSkeleton rows={7} /></>;
  }

  if (!invoice) {
    return <><ScreenHeader title="Facturas" breadcrumbs={["Detalle"]} hasBackButton />{error ? <div style={styles.error}>{error}</div> : null}</>;
  }

  return (
    <div>
      <ScreenHeader title="Facturas" breadcrumbs={["Detalle"]} hasBackButton />
      <FacturaSummaryCard
        invoice={invoice}
        working={working}
        canManage={canManage}
        onDownloadPdf={() => window.location.assign(`/api/facturas/${invoice.id}/pdf`)}
        onReconcile={reconcile}
      />

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}

      <section style={styles.section}>
        <SectionHeading title="Detalle del comprobante" description="Conceptos y totales incluidos en la emisión." />
        <Card style={styles.sectionCard}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Descripción</th>
                  <th style={styles.thRight}>Cantidad</th>
                  <th style={styles.thRight}>Unitario</th>
                  <th style={styles.thRight}>IVA</th>
                  <th style={styles.thRight}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineas.map((line) => (
                  <tr key={`${line.ordinal}-${line.descripcion}`}>
                    <td style={styles.td}>{line.codigo ?? "-"}</td>
                    <td style={styles.td}>{line.descripcion}</td>
                    <td style={styles.tdRight}>{line.cantidad}</td>
                    <td style={styles.tdRight}>{money(line.importeUnitario)}</td>
                    <td style={styles.tdRight}>{line.ivaAlicuota ? `${line.ivaAlicuota}%` : "-"}</td>
                    <td style={styles.tdRight}><strong>{money(line.subtotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={styles.totals}>
            <Info label="Neto gravado" value={money(invoice.totales.netoGravado)} />
            <Info label="IVA" value={money(invoice.totales.iva)} />
            <Info label="Exento / no gravado" value={money(invoice.totales.exento + invoice.totales.noGravado)} />
            <Info label="Total" value={money(invoice.total)} strong />
          </div>
        </Card>
      </section>

      <section style={styles.section}>
        <SectionHeading title="Datos fiscales" description="Información registrada al momento de emitir el comprobante." />
        <div style={styles.twoColumns}>
          <Card style={styles.sectionCard}>
            <h3 style={styles.cardTitle}>Emisor</h3>
            <Info label="Razón social" value={value(invoice.emisorSnapshot, "razonSocial")} />
            <Info label="CUIT" value={value(invoice.emisorSnapshot, "cuit")} />
            <Info label="Condición IVA" value={value(invoice.emisorSnapshot, "condicionIva")} />
            <Info label="Domicilio" value={value(invoice.emisorSnapshot, "domicilio")} />
          </Card>
          <Card style={styles.sectionCard}>
            <h3 style={styles.cardTitle}>Receptor</h3>
            <Info label="Nombre / razón social" value={invoice.receptorNombre} />
            <Info label="Documento" value={invoice.receptorDocumento ?? "Sin identificar"} />
            <Info label="Domicilio" value={value(invoice.receptorSnapshot, "domicilio")} />
            <Info label="Condición de venta" value={invoice.condicionVenta} />
          </Card>
        </div>
      </section>

      {invoice.documentoAsociado || invoice.documentosAjuste.length ? (
        <section style={styles.section}>
          <Card style={styles.sectionCard}>
            <h2 style={styles.cardTitle}>Documentos asociados</h2>
            <div style={styles.associatedDocuments}>
              {invoice.documentoAsociado ? <FacturaListItem invoice={invoice.documentoAsociado} /> : null}
              {invoice.documentosAjuste.map((item) => <FacturaListItem key={item.id} invoice={item} />)}
            </div>
          </Card>
        </section>
      ) : null}

      {canManage && invoice.estado === "AUTORIZADA" && invoice.documentoTipo === "FACTURA" ? (
        <section style={styles.section}>
          <Card style={styles.sectionCard}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Ajustes fiscales</h2>
                <p style={styles.muted}>Emití una nota asociada sin modificar la factura autorizada.</p>
              </div>
              <div style={styles.actions}>
                <Button text="Nota de crédito" icon={<RotateCcw size={16} />} outline onClick={() => openNote("NOTA_CREDITO")} hideTextOnMobile={false} />
                <Button text="Nota de débito" icon={<TrendingUp size={16} />} outline onClick={() => openNote("NOTA_DEBITO")} hideTextOnMobile={false} />
              </div>
            </div>
            {noteOpen ? (
              <form onSubmit={issueNote} style={styles.noteForm}>
                <label style={styles.field}>Importe<input required type="number" min="0.01" step="0.01" style={styles.input} value={noteAmount} onChange={(event) => setNoteAmount(event.target.value)} /></label>
                <label style={{ ...styles.field, flex: "1 1 260px" }}>Motivo<input required maxLength={200} style={styles.input} value={noteReason} onChange={(event) => setNoteReason(event.target.value)} /></label>
                <Button type="submit" text={working ? "Emitiendo…" : "Emitir nota"} disabled={working} hideTextOnMobile={false} />
                <Button type="button" text="Cancelar" outline onClick={closeNote} hideTextOnMobile={false} />
              </form>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section style={styles.section}>
        <Card style={styles.sectionCard}>
          <h2 style={styles.cardTitle}>Trazabilidad de emisión</h2>
          {invoice.intentos.length ? (
            <div style={styles.timeline}>
              {invoice.intentos.map((attempt) => (
                <div style={styles.attempt} key={attempt.id}>
                  <span style={styles.attemptNumber}>#{attempt.numeroIntento}</span>
                  <div><strong>{attempt.estado}</strong><div style={styles.muted}>{attempt.errorMensaje ?? `Registrado ${date(attempt.createdAt)}`}</div></div>
                </div>
              ))}
            </div>
          ) : <p style={styles.muted}>Todavía no hay intentos registrados.</p>}
        </Card>
      </section>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div style={styles.sectionHeader}><div><h2 style={styles.sectionTitle}>{title}</h2><p style={styles.muted}>{description}</p></div></div>;
}

function Info({ label, value: content, strong }: { label: string; value: string; strong?: boolean }) {
  return <div style={styles.info}><span>{label}</span>{strong ? <strong>{content}</strong> : <span>{content}</span>}</div>;
}

const styles = {
  section: { marginTop: 24 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12, flexWrap: "wrap" as const },
  sectionTitle: { fontSize: 20, fontWeight: 600, margin: 0 },
  sectionCard: { background: COLOR.BACKGROUND.SECONDARY },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  cardTitle: { margin: "0 0 12px", fontSize: 18 },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  info: { display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 720 },
  th: { textAlign: "left" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  thRight: { textAlign: "right" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  td: { padding: "10px 8px", fontSize: 13, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  tdRight: { padding: "10px 8px", fontSize: 13, textAlign: "right" as const, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  totals: { marginLeft: "auto", marginTop: 12, maxWidth: 380 },
  timeline: { display: "flex", flexDirection: "column" as const, gap: 9 },
  attempt: { display: "flex", gap: 10, alignItems: "flex-start" },
  attemptNumber: { background: COLOR.BACKGROUND.SUBTLE, borderRadius: 8, padding: "5px 8px", fontFamily: "monospace", fontSize: 12 },
  muted: { color: COLOR.TEXT.SECONDARY, margin: 0, fontSize: 13 },
  associatedDocuments: { display: "flex", flexDirection: "column" as const, gap: 9 },
  noteForm: { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" as const, borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, marginTop: 14, paddingTop: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  input: { height: 42, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 12px", background: COLOR.INPUT.PRIMARY.BACKGROUND, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginTop: 12 },
} as const;
