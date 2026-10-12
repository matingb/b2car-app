"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, TrendingUp } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import FacturaListItem from "@/app/components/facturacion/FacturaListItem";
import FacturaSummaryCard from "@/app/components/facturacion/FacturaSummaryCard";
import FacturaRemitosSection from "@/app/components/remitos/FacturaRemitosSection";
import ReadOnlyLineaCard from "@/app/components/arreglos/lineas/shared/ReadOnlyLineaCard";
import NumberInput from "@/app/components/ui/NumberInput";
import NotaConceptosSection from "@/app/components/facturacion/NotaConceptosSection";
import {
  buildConceptosCatalogo,
  conceptosError,
  fromCents,
  sumCents,
  toConceptosPayload,
  type ConceptoNota,
} from "@/lib/facturacion/notaCreditoConceptos";
import {
  type DevolucionStockDisponible,
  type DevolucionesDisponiblesResult,
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
  const [noteIdempotencyKey, setNoteIdempotencyKey] = useState<string | null>(null);
  const [stockReturns, setStockReturns] = useState<DevolucionStockDisponible[]>([]);
  const [stockReturnsWarning, setStockReturnsWarning] = useState<string | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [stockReturnsLoading, setStockReturnsLoading] = useState(false);
  const [stockReturnsFailed, setStockReturnsFailed] = useState(false);
  const [noteItems, setNoteItems] = useState<ConceptoNota[]>([]);

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

  const creditCatalog = useMemo(
    () => buildConceptosCatalogo(invoice?.lineas ?? [], stockReturns),
    [invoice?.lineas, stockReturns],
  );
  // Facturas con detalle simplificado no tienen una línea fiscal por producto: su stock se devuelve aparte.
  const unlinkedStockReturns = useMemo(
    () => stockReturns.filter((line) => !(invoice?.lineas ?? []).some((fiscal) => fiscal.sourceId === line.operacionLineaId)),
    [invoice?.lineas, stockReturns],
  );
  const noteValidation = noteOpen ? conceptosError(noteItems) : null;

  const creditReturns = () => {
    const linked = new Set(creditCatalog.filter((line) => line.stockRestante !== null).map((line) => line.ordinal));
    const fiscalSource = new Map((invoice?.lineas ?? []).map((line) => [line.ordinal, line.sourceId]));
    return [
      ...noteItems
        .filter((item) => item.tipo === "FACTURA" && item.ordinal !== null && linked.has(item.ordinal) && item.cantidad > 0)
        .map((item) => ({ operacionLineaId: String(fiscalSource.get(item.ordinal as number)), cantidad: item.cantidad })),
      ...unlinkedStockReturns.map((line) => ({
        operacionLineaId: line.operacionLineaId,
        cantidad: Number(returnQuantities[line.operacionLineaId] ?? line.restante),
      })),
    ];
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
          importe: fromCents(sumCents(noteItems)),
          idempotencyKey: noteIdempotencyKey,
          conceptos: toConceptosPayload(noteItems),
          devoluciones: noteOpen === "NOTA_CREDITO" ? creditReturns() : [],
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

  const openNote = async (type: "NOTA_CREDITO" | "NOTA_DEBITO") => {
    setNoteOpen(type);
    setNoteIdempotencyKey(crypto.randomUUID());
    setError(null);
    setNoteItems([]);
    setStockReturns([]);
    setStockReturnsWarning(null);
    setReturnQuantities({});
    setStockReturnsFailed(false);
    if (type === "NOTA_CREDITO") {
      setStockReturnsLoading(true);
      try {
        const response = await fetch(`/api/facturas/${params.id}/devoluciones`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo consultar el stock retornable");
        const available = body.data as DevolucionesDisponiblesResult;
        setStockReturns(available.items);
        setStockReturnsWarning(available.advertencia);
        setReturnQuantities(Object.fromEntries(available.items.map((line) => [line.operacionLineaId, String(line.restante)])));
      } catch (cause) {
        setStockReturnsFailed(true);
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el stock retornable");
      } finally {
        setStockReturnsLoading(false);
      }
    }
  };

  const closeNote = () => {
    setNoteOpen(null);
    setNoteIdempotencyKey(null);
    setNoteItems([]);
    setStockReturns([]);
    setStockReturnsWarning(null);
    setReturnQuantities({});
    setStockReturnsFailed(false);
  };

  if (loading) {
    return <><ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton /><p role="status" style={{ color: COLOR.TEXT.SECONDARY, padding: "24px 0" }}>Cargando documento…</p></>;
  }

  if (!invoice) {
    return <><ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton />{error ? <div style={styles.error}>{error}</div> : null}</>;
  }

  return (
    <div>
      <ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton />
      <FacturaSummaryCard
        invoice={invoice}
        working={working}
        canManage={canManage}
        onDownloadPdf={() => window.location.assign(`/api/facturas/${invoice.id}/pdf`)}
        onReconcile={reconcile}
      />

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}
      {[201,206,211].includes(invoice.tipoComprobante) ? <section style={styles.section}>
        <Card>
          <h2 style={styles.cardTitle}>Factura de Crédito Electrónica MiPyME</h2>
          <Info label="Sistema indicado al emitir" value={invoice.fceSistema ?? "-"} />
          <Info label="CBU fiscal del snapshot" value={invoice.fceCbu ?? "-"} />
          <Info label="Vencimiento de pago" value={invoice.fechaVencimientoPago ?? "-"} />
        </Card>
      </section> : null}

      <section style={styles.section}>
        <SectionHeading title="Detalle del comprobante" description="Conceptos y totales incluidos en la emisión." />
        <Card>
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

      {invoice.documentoTipo === "FACTURA" && invoice.estado === "AUTORIZADA" ? (
        <FacturaRemitosSection facturaId={invoice.id} />
      ) : null}

      <section style={styles.section}>
        <SectionHeading title="Datos fiscales" description="Información registrada al momento de emitir el comprobante." />
        <div style={styles.twoColumns}>
          <Card>
            <h3 style={styles.cardTitle}>Emisor</h3>
            <Info label="Razón social" value={value(invoice.emisorSnapshot, "razonSocial")} />
            <Info label="CUIT" value={value(invoice.emisorSnapshot, "cuit")} />
            <Info label="Condición IVA" value={value(invoice.emisorSnapshot, "condicionIva")} />
            <Info label="Domicilio" value={value(invoice.emisorSnapshot, "domicilio")} />
          </Card>
          <Card>
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
          <Card>
            <h2 style={styles.cardTitle}>Documentos asociados</h2>
            <div style={styles.associatedDocuments}>
              {invoice.documentoAsociado ? <FacturaListItem invoice={invoice.documentoAsociado} /> : null}
              {invoice.documentosAjuste.map((item) => <FacturaListItem key={item.id} invoice={item} />)}
            </div>
          </Card>
        </section>
      ) : null}

      {canManage && invoice.estado === "AUTORIZADA" && invoice.documentoTipo === "FACTURA" && ![201,206,211].includes(invoice.tipoComprobante) ? (
        <section style={styles.section}>
          <Card>
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
                {!stockReturnsLoading ? (
                  <>
                    {noteOpen === "NOTA_CREDITO" && stockReturnsWarning ? <p role="status" style={styles.warning}>{stockReturnsWarning}</p> : null}
                    <NotaConceptosSection
                      tipo={noteOpen}
                      catalog={noteOpen === "NOTA_CREDITO" ? creditCatalog : []}
                      items={noteItems}
                      onItemsChange={setNoteItems}
                      disabled={working}
                    />
                  </>
                ) : null}
                {noteOpen === "NOTA_CREDITO" && !stockReturnsLoading && unlinkedStockReturns.length > 0 ? (
                  <Card aria-label="Productos que vuelven al stock">
                    <div style={styles.returnsSection}>
                      <h3 style={styles.cardTitle}>Productos que vuelven al stock</h3>
                      <p style={styles.muted}>La factura se emitió con detalle simplificado: las unidades que regresan al inventario se eligen por separado del importe.</p>
                      {unlinkedStockReturns.length ? (
                        <>
                          <div style={styles.returnsList}>
                            {unlinkedStockReturns.map((line) => (
                              <ReadOnlyLineaCard
                                key={line.operacionLineaId}
                                kind="repuestos"
                                allowTitleWrap
                                title={
                                  <div style={styles.returnTitle}>
                                    <span>{line.nombre}</span>
                                    {line.codigo ? <span style={styles.returnCode}>{line.codigo}</span> : null}
                                  </div>
                                }
                                detailContent={
                                  <span style={styles.returnStats}>
                                    <span><strong>{line.origenLinea === "REPUESTO" ? "Asignado originalmente" : "Vendido"}</strong> {line.cantidadOriginal}</span>
                                    <span>Devuelto <strong>{line.devuelto}</strong></span>
                                    {line.reservado > 0 ? <span>Reservado <strong>{line.reservado}</strong></span> : null}
                                    <span>Disponible <strong>{line.restante}</strong></span>
                                  </span>
                                }
                                sideContent={
                                  <label style={styles.returnQuantityField}>
                                    <span>A devolver</span>
                                    <NumberInput
                                      aria-label={`Cantidad a devolver: ${line.nombre}`}
                                      minValue={0}
                                      max={line.restante}
                                      step="1"
                                      allowDecimals={false}
                                      value={Math.max(0, Number(returnQuantities[line.operacionLineaId] ?? line.restante) || 0)}
                                      onValueChange={(quantity) => setReturnQuantities((current) => ({ ...current, [line.operacionLineaId]: String(quantity) }))}
                                      style={styles.quantityInput}
                                    />
                                  </label>
                                }
                                cantidad={line.cantidadOriginal}
                                unitario={0}
                                onEdit={() => undefined}
                                onDelete={() => undefined}
                                canInteract={false}
                                readOnly
                              />
                            ))}
                          </div>
                          <p style={styles.muted}>Resumen: {unlinkedStockReturns.reduce((sum, line) => sum + Number(returnQuantities[line.operacionLineaId] ?? line.restante), 0)} unidades volverían al stock al autorizarse la nota.</p>
                        </>
                      ) : null}
                    </div>
                  </Card>
                ) : null}
                {noteOpen === "NOTA_CREDITO" && stockReturnsLoading ? <p style={styles.muted}>Consultando cantidades retornables…</p> : null}
                {noteValidation && noteItems.length ? <p role="status" style={styles.muted}>{noteValidation}</p> : null}
                <div style={styles.noteActions}>
                  <Button type="submit" text={working ? "Emitiendo…" : "Emitir nota"} disabled={working || stockReturnsLoading || stockReturnsFailed || Boolean(noteValidation)} hideTextOnMobile={false} />
                  <Button type="button" text="Cancelar" outline onClick={closeNote} hideTextOnMobile={false} />
                </div>
              </form>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section style={styles.section}>
        <Card>
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
  noteForm: { display: "flex", flexDirection: "column" as const, alignItems: "stretch", gap: 14, borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, marginTop: 14, paddingTop: 14 },
  noteActions: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  returnsSection: { display: "flex", flexDirection: "column" as const, gap: 8 },
  warning: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, fontSize: 13 },
  returnsList: { display: "flex", flexDirection: "column" as const, gap: 10, margin: "12px 0" },
  returnTitle: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const },
  returnCode: { marginLeft: 4, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  returnStats: { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  returnQuantityField: { display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  quantityInput: { width: 86, height: 38, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 10px", background: COLOR.INPUT.PRIMARY.BACKGROUND, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginTop: 12 },
} as const;
