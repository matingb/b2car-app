"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import ComprobanteRecibidoSummaryCard from "@/app/components/comprobantesRecibidos/ComprobanteRecibidoSummaryCard";
import ComprobanteRecibidoModal from "@/app/components/comprobantesRecibidos/ComprobanteRecibidoModal";
import { useTenant } from "@/app/providers/TenantProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import {
  comprobanteRecibidoTitulo,
  condicionIvaLabel,
  formatCuit,
  percepcionLabel,
  type ComprobanteRecibido,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { Permission } from "@/lib/permissions";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

/** Detalle de una factura o retención recibida de un proveedor (compra o gasto). */
export default function ComprobanteRecibidoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useTenant();
  const canEdit = hasPermission(Permission.ComprobantesRecibidosEdit);
  const { success, error: toastError } = useToast();
  const { confirm } = useModalMessage();

  const [comprobante, setComprobante] = useState<ComprobanteRecibido | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComprobante(await comprobantesRecibidosClient.getById(params.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el documento");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!comprobante) return;
    const esFactura = comprobante.tipoDocumento === "FACTURA";
    const ok = await confirm({
      title: `Eliminar ${esFactura ? "factura" : "retención"}`,
      message: `¿Eliminar ${comprobanteRecibidoTitulo(comprobante)}? Se elimina solo el documento: la operación, sus pagos y su stock no cambian.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    setWorking(true);
    try {
      await comprobantesRecibidosClient.remove(comprobante.id);
      success("Documento eliminado", "La operación conserva sus pagos, saldos y stock.");
      router.push(ROUTES.facturacion);
    } catch (cause) {
      toastError("No se pudo eliminar", cause instanceof Error ? cause.message : "Error inesperado");
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <>
        <ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton />
        <p role="status" style={{ color: COLOR.TEXT.SECONDARY, padding: "24px 0" }}>Cargando documento…</p>
      </>
    );
  }

  if (!comprobante) {
    return (
      <>
        <ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton />
        {error ? <div role="alert" style={styles.error}>{error}</div> : null}
      </>
    );
  }

  const esFactura = comprobante.tipoDocumento === "FACTURA";

  return (
    <div>
      <ScreenHeader title="Documentos" breadcrumbs={["Detalle"]} hasBackButton />
      <ComprobanteRecibidoSummaryCard
        comprobante={comprobante}
        canEdit={canEdit}
        working={working}
        onEdit={() => setEditOpen(true)}
        onDelete={() => void handleDelete()}
      />

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}

      <section style={styles.section}>
        <SectionHeading
          title="Detalle del comprobante"
          description={esFactura ? "Conceptos y percepciones informados en la factura." : "Conceptos informados en la retención."}
        />
        <Card>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Descripción</th>
                  <th style={styles.thRight}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {comprobante.lineas.map((linea, index) => (
                  <tr key={linea.id ?? index}>
                    <td style={styles.td}>{linea.tipo === "PERCEPCION" ? "Percepción" : "Concepto"}</td>
                    <td style={styles.td}>
                      {linea.tipo === "PERCEPCION" ? percepcionLabel(linea.percepcionCodigo, linea.descripcion) : linea.descripcion}
                    </td>
                    <td style={styles.tdRight}><strong>{formatArs(linea.importe)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={styles.totals}>
            {esFactura ? (
              <>
                <Info label="Conceptos" value={formatArs(comprobante.totalConceptos)} />
                <Info label="Percepciones" value={formatArs(comprobante.totalPercepciones)} />
              </>
            ) : null}
            <Info label="Total" value={formatArs(comprobante.total)} strong />
          </div>
        </Card>
      </section>

      <section style={styles.section}>
        <SectionHeading title="Datos fiscales" description="Copia registrada al cargar el documento: no cambia si se edita la ficha del proveedor." />
        <div style={styles.twoColumns}>
          <Card>
            <h3 style={styles.cardTitle}>Emisor</h3>
            <Info label="Razón social" value={comprobante.emisor.razonSocial ?? "-"} />
            <Info label="CUIT" value={formatCuit(comprobante.emisor.cuit) || "-"} />
            <Info label="Condición IVA" value={condicionIvaLabel(comprobante.emisor.condicionIva)} />
            <Info label="Domicilio" value={comprobante.emisor.domicilio ?? "-"} />
          </Card>
          <Card>
            <h3 style={styles.cardTitle}>Receptor</h3>
            <Info label="Razón social" value={comprobante.receptor.razonSocial ?? "-"} />
            <Info label="CUIT" value={formatCuit(comprobante.receptor.cuit) || "-"} />
            <Info label="Condición IVA" value={condicionIvaLabel(comprobante.receptor.condicionIva)} />
          </Card>
        </div>
      </section>

      <section style={styles.section}>
        <Card>
          <h2 style={styles.cardTitle}>Datos informados</h2>
          {esFactura ? (
            <Info label="Fecha de vencimiento" value={formatCalendarDateLabel(comprobante.fechaVencimiento, "Sin vencimiento")} />
          ) : null}
          {/* Documentos cargados antes de quitar el campo: se muestra el CAE/CAI que tengan. */}
          {comprobante.codigoAutorizacion ? (
            <Info label="Código de autorización (CAE/CAI)" value={comprobante.codigoAutorizacion} />
          ) : null}
          <Info label="Observaciones" value={comprobante.observaciones ?? "-"} />
        </Card>
      </section>

      {editOpen ? (
        <ComprobanteRecibidoModal
          open
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => setComprobante(saved)}
          operacionId={comprobante.operacionId}
          precarga={{ proveedorId: comprobante.proveedorId, emisor: comprobante.emisor, receptor: comprobante.receptor }}
          comprobante={comprobante}
        />
      ) : null}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.muted}>{description}</p>
      </div>
    </div>
  );
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
  info: { display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 520 },
  th: { textAlign: "left" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  thRight: { textAlign: "right" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  td: { padding: "10px 8px", fontSize: 13, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  tdRight: { padding: "10px 8px", fontSize: 13, textAlign: "right" as const, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  totals: { marginLeft: "auto", marginTop: 12, maxWidth: 380 },
  muted: { color: COLOR.TEXT.SECONDARY, margin: 0, fontSize: 13 },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginTop: 12 },
} as const;
