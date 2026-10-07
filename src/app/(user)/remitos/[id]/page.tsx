"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import RemitoSummaryCard from "@/app/components/remitos/RemitoSummaryCard";
import AsociarFacturaModal from "@/app/components/remitos/AsociarFacturaModal";
import { remitosClient } from "@/clients/remitosClient";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { formatRemitoCantidad, formatRemitoDocumento, type RemitoDetalle } from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

export default function RemitoDetailPage() {
  const params = useParams<{ id: string }>();
  const [remito, setRemito] = useState<RemitoDetalle | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asociarOpen, setAsociarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await remitosClient.get(params.id);
      setRemito(data.remito);
      setCanManage(data.canManage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el remito");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <><ScreenHeader title="Documentación" breadcrumbs={["Detalle"]} hasBackButton /><ListSkeleton rows={7} /></>;
  }

  if (!remito) {
    return (
      <>
        <ScreenHeader title="Documentación" breadcrumbs={["Detalle"]} hasBackButton />
        {error ? <div role="alert" style={styles.error}>{error}</div> : null}
      </>
    );
  }

  const imprenta = remito.impresion?.imprenta ?? null;
  const rango = remito.impresion?.numeroDesde != null && remito.impresion?.numeroHasta != null
    ? `${pad(remito.puntoEmision, 5)}-${pad(remito.impresion.numeroDesde, 8)} al ${pad(remito.puntoEmision, 5)}-${pad(remito.impresion.numeroHasta, 8)}`
    : null;

  return (
    <div>
      <ScreenHeader title="Documentación" breadcrumbs={["Detalle"]} hasBackButton />
      <RemitoSummaryCard
        remito={remito}
        canManage={canManage}
        onDownloadPdf={() => window.location.assign(`/api/remitos/${remito.id}/pdf`)}
        onAsociar={() => setAsociarOpen(true)}
      />

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}

      <section style={styles.section}>
        <div style={styles.twoColumns}>
          <Card style={styles.sectionCard}>
            <h3 style={styles.cardTitle}>Emisor</h3>
            <Info label="Razón social" value={remito.emisor.razonSocial} />
            <Info label="CUIT" value={remito.emisor.cuit} />
            <Info label="Condición IVA" value={remito.emisor.condicionIva || "-"} />
            <Info label="Domicilio comercial" value={remito.emisor.domicilio} />
            <Info label="Ingresos brutos" value={remito.emisor.ingresosBrutos ?? "-"} />
            <Info
              label="Inicio de actividades"
              value={formatCalendarDateLabel(remito.impresion?.inicioActividades ?? remito.emisor.inicioActividades, "-")}
            />
          </Card>
          <Card style={styles.sectionCard}>
            <h3 style={styles.cardTitle}>Destinatario</h3>
            <Info label="Nombre / razón social" value={remito.destinatario.nombre} />
            <Info label="Documento" value={formatRemitoDocumento(remito.destinatario) ?? "Sin documento"} />
            <Info label="Condición IVA" value={remito.destinatario.condicionIva ?? "-"} />
            <Info label="Domicilio" value={remito.destinatario.domicilio ?? "-"} />
          </Card>
          {remito.transportista ? (
            <Card style={styles.sectionCard}>
              <h3 style={styles.cardTitle}>Transportista</h3>
              <Info label="Nombre / razón social" value={remito.transportista.nombre} />
              <Info label="CUIT" value={remito.transportista.cuit ?? "-"} />
              <Info label="Domicilio" value={remito.transportista.domicilio ?? "-"} />
            </Card>
          ) : null}
          {remito.clase === "R" ? (
            <Card style={styles.sectionCard}>
              <h3 style={styles.cardTitle}>CAI e impresión</h3>
              <Info label="CAI" value={remito.cai ?? "-"} />
              <Info label="Vencimiento del CAI" value={formatCalendarDateLabel(remito.caiVencimiento, "-")} />
              <Info label="Numeración autorizada" value={rango ?? "Sin rango configurado"} />
              <Info label="Modalidad" value={remito.impresion?.autoimpresor ? "Autoimpresor" : "Imprenta"} />
              {imprenta ? (
                <>
                  <Info label="Imprenta" value={`${imprenta.razonSocial} · CUIT ${imprenta.cuit}`} />
                  <Info label="Habilitación" value={imprenta.habilitacion} />
                  <Info label="Fecha de impresión" value={formatCalendarDateLabel(imprenta.fechaImpresion, "-")} />
                </>
              ) : null}
            </Card>
          ) : null}
        </div>
      </section>

      <section style={styles.section}>
        <Card style={styles.sectionCard}>
          <h3 style={styles.cardTitle}>Ítems</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Artículo / descripción</th>
                  <th style={styles.th}>Observaciones</th>
                  <th style={styles.thRight}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {remito.lineas.map((linea) => (
                  <tr key={linea.id}>
                    <td style={styles.td}>{linea.codigo ?? "-"}</td>
                    <td style={styles.td}>{linea.descripcion}</td>
                    <td style={styles.td}>{linea.observaciones ?? "-"}</td>
                    <td style={styles.tdRight}><strong>{formatRemitoCantidad(linea.cantidad)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {remito.observaciones ? (
        <section style={styles.section}>
          <Card style={styles.sectionCard}>
            <h3 style={styles.cardTitle}>Observaciones</h3>
            <p style={styles.observaciones}>{remito.observaciones}</p>
          </Card>
        </section>
      ) : null}

      <AsociarFacturaModal
        open={asociarOpen}
        remito={remito}
        onClose={() => setAsociarOpen(false)}
        onAssociated={() => {
          setAsociarOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div style={styles.info}><span>{label}</span><span style={styles.infoValue}>{value}</span></div>;
}

const styles = {
  section: { marginTop: 24 },
  sectionCard: { background: COLOR.BACKGROUND.SECONDARY },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  cardTitle: { margin: "0 0 12px", fontSize: 18 },
  info: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "8px 0",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  infoValue: { color: COLOR.TEXT.PRIMARY, textAlign: "right" as const, overflowWrap: "anywhere" as const },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 560 },
  th: { textAlign: "left" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  thRight: { textAlign: "right" as const, padding: "9px 8px", color: COLOR.TEXT.SECONDARY, fontSize: 12, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  td: { padding: "10px 8px", fontSize: 13, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  tdRight: { padding: "10px 8px", fontSize: 13, textAlign: "right" as const, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}` },
  observaciones: { margin: 0, whiteSpace: "pre-wrap" as const, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginTop: 12 },
} as const;
