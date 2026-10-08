"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, PackageCheck, ReceiptText, Send } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ModalMessage from "@/app/components/ui/ModalMessage";
import { useTenant } from "@/app/providers/TenantProvider";
import { remitosClient } from "@/clients/remitosClient";
import { Permission } from "@/lib/permissions";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import type { RemitoClase, RemitoPreflight } from "@/lib/remitos/types";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import RemitoTipoSelector from "./RemitoTipoSelector";
import RemitoDestinatarioFields, {
  DESTINATARIO_VACIO,
  destinatarioFormDesde,
  destinatarioPayload,
  type DestinatarioForm,
} from "./RemitoDestinatarioFields";
import RemitoTransportistaFields, {
  TRANSPORTISTA_VACIO,
  transportistaPayload,
  type TransportistaForm,
} from "./RemitoTransportistaFields";
import RemitoLineasEditor, { lineasLibresPayload, nuevaLineaLibre, type LineaLibreForm } from "./RemitoLineasEditor";
import RemitoFacturaLineasSelector, {
  lineasFacturaPayload,
  seleccionInicial,
  validarSeleccionFactura,
} from "./RemitoFacturaLineasSelector";
import { remitoFormStyles } from "./remitoFormStyles";

type Props = {
  facturaId: string | null;
  arregloId?: string | null;
  onEmitted: (remitoId: string) => void;
  onCancel?: () => void;
};

export default function RemitoForm({ facturaId, arregloId = null, onEmitted, onCancel }: Props) {
  const { hasPermission } = useTenant();
  const [preflight, setPreflight] = useState<RemitoPreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clase, setClase] = useState<RemitoClase | null>(null);
  const [destinatario, setDestinatario] = useState<DestinatarioForm>(DESTINATARIO_VACIO);
  const [transportista, setTransportista] = useState<TransportistaForm>(TRANSPORTISTA_VACIO);
  const [observaciones, setObservaciones] = useState("");
  const [lineasLibres, setLineasLibres] = useState<LineaLibreForm[]>(() => [nuevaLineaLibre()]);
  // Se genera al montar, se reutiliza en reintentos y se renueva solo tras una emisión exitosa.
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateUuidV4());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await remitosClient.preflight(facturaId, arregloId);
      setPreflight(data);
      if (data.factura) {
        setDestinatario(destinatarioFormDesde(data.factura.destinatario));
        setLineasLibres(seleccionInicial(data.factura.lineas));
      } else if (data.arreglo) {
        setDestinatario(destinatarioFormDesde(data.arreglo.destinatario));
        setLineasLibres(data.arreglo.lineas.map((linea) => nuevaLineaLibre({
          codigo: linea.codigo ?? "",
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
        })));
      }
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "No se pudo preparar el remito");
    } finally {
      setLoading(false);
    }
  }, [facturaId, arregloId]);

  useEffect(() => {
    void load();
  }, [load]);

  const factura = preflight?.factura ?? null;
  const arreglo = preflight?.arreglo ?? null;
  const tipoSeleccionado = clase && preflight ? preflight.tipos[clase] : null;

  const blockingReason = useMemo(() => {
    if (!preflight) return "Cargando…";
    if (!preflight.emisor.completo) return "Completá los datos fiscales del emisor para emitir.";
    if (!clase) return "Seleccioná el tipo de remito.";
    if (tipoSeleccionado && !tipoSeleccionado.emitible) {
      return `El Remito ${clase} no se puede emitir con la configuración actual.`;
    }
    if (!destinatario.nombre.trim()) return "Completá el nombre del destinatario.";
    if (destinatario.tipoDocumento && !destinatario.numeroDocumento.trim()) {
      return "Completá el número de documento del destinatario.";
    }
    if (factura) return validarSeleccionFactura(factura.lineas, lineasLibres);
    if (lineasLibres.length === 0) return "Agregá al menos un ítem al detalle del remito.";
    const sinDescripcion = lineasLibres.findIndex((linea) => !linea.descripcion.trim());
    if (sinDescripcion >= 0) return `Completá la descripción del ítem ${sinDescripcion + 1}.`;
    const sinCantidad = lineasLibres.findIndex((linea) => !(linea.cantidad > 0));
    if (sinCantidad >= 0) return `La cantidad del ítem ${sinCantidad + 1} debe ser mayor a 0.`;
    return null;
  }, [preflight, clase, tipoSeleccionado, destinatario, factura, lineasLibres]);

  const emitir = async () => {
    if (!clase || blockingReason) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      const id = await remitosClient.emitir({
        idempotencyKey,
        clase,
        arregloId: arreglo?.id ?? null,
        facturaId: factura?.id ?? null,
        destinatario: destinatarioPayload(destinatario),
        transportista: transportistaPayload(transportista),
        observaciones: observaciones.trim() || null,
        lineas: factura ? lineasFacturaPayload(lineasLibres) : lineasLibresPayload(lineasLibres),
      });
      setIdempotencyKey(generateUuidV4());
      onEmitted(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo emitir el remito");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ListSkeleton rows={6} />;
  if (!preflight) {
    return <div role="alert" style={styles.errorAlert}><AlertCircle size={18} />{loadError ?? "No se pudo preparar el remito"}</div>;
  }

  const canConfigure = hasPermission(Permission.ConfiguracionView);
  const configLink = canConfigure ? (
    <Link href={ROUTES.configuracionFacturacion} style={styles.link}>Ir a Configuración &gt; Facturación</Link>
  ) : null;

  return (
    <form
      style={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!blockingReason) setConfirmOpen(true);
      }}
    >
      {!preflight.emisor.completo ? (
        <div role="alert" style={styles.errorAlert}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Faltan datos fiscales del emisor.</strong> Completá: {preflight.emisor.faltantes.join(", ")}.{" "}
            {configLink}
          </div>
        </div>
      ) : null}

      {factura ? (
        <Card style={styles.facturaBanner}>
          <ReceiptText size={18} color={COLOR.ACCENT.PRIMARY} />
          <span>
            Remito generado desde <Link href={`/facturacion/${factura.id}`} style={styles.link}>{factura.label}</Link>
            {factura.fechaComprobante ? ` del ${formatCalendarDateLabel(factura.fechaComprobante)}` : ""}
          </span>
        </Card>
      ) : null}

      {arreglo ? (
        <Card style={styles.facturaBanner}>
          <PackageCheck size={18} color={COLOR.ACCENT.PRIMARY} />
          <span>
            Remito iniciado desde <Link href={`/arreglos/${arreglo.id}`} style={styles.link}>{arreglo.label}</Link>.
            {" "}Podés editar este detalle sin modificar el arreglo.
          </span>
        </Card>
      ) : null}

      <Section title="Tipo de remito" description="Elegí libremente R o X. La sugerencia normativa es solo orientativa.">
        <RemitoTipoSelector value={clase} onChange={setClase} tipos={preflight.tipos} />
        {clase === "R" && !preflight.tipos.R.emitible ? (
          <div role="alert" style={styles.warningAlert} data-testid="remito-r-motivos">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Para emitir un Remito R falta completar la configuración:</strong>
              <ul style={styles.list}>
                {preflight.tipos.R.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}
              </ul>
              {configLink}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Destinatario" description="Datos de quien recibe los bienes.">
        <RemitoDestinatarioFields value={destinatario} onChange={setDestinatario} disabled={submitting} />
      </Section>

      <Section title="Transportista" description="Completalo solo si un tercero realiza el traslado.">
        <RemitoTransportistaFields value={transportista} onChange={setTransportista} disabled={submitting} />
      </Section>

      <Section
        title="Detalle del remito"
        description={factura
          ? "Editá los bienes que se entregan. Cada ítem conserva una referencia a la factura para controlar las cantidades disponibles."
          : arreglo
            ? "Los bienes del arreglo se precargaron como referencia. Podés agregarlos, quitarlos o modificarlos; el remito guarda su propio detalle."
            : "Agregá los bienes y cantidades trasladados. El remito no lleva precios."}
      >
        {factura ? (
          <RemitoFacturaLineasSelector lineas={factura.lineas} value={lineasLibres} onChange={setLineasLibres} disabled={submitting} />
        ) : (
          <RemitoLineasEditor value={lineasLibres} onChange={setLineasLibres} disabled={submitting} />
        )}
      </Section>

      <Section title="Observaciones generales">
        <textarea
          aria-label="Observaciones generales"
          maxLength={1000}
          value={observaciones}
          disabled={submitting}
          onChange={(event) => setObservaciones(event.target.value)}
          style={remitoFormStyles.textarea}
        />
      </Section>

      {error ? <div role="alert" style={styles.errorAlert}><AlertCircle size={18} style={{ flexShrink: 0 }} />{error}</div> : null}

      <div style={styles.actions}>
        {blockingReason && !submitting ? <span style={styles.blockingReason} data-testid="remito-blocking-reason">{blockingReason}</span> : null}
        {onCancel ? <Button type="button" text="Cancelar" outline onClick={onCancel} disabled={submitting} hideTextOnMobile={false} /> : null}
        <Button
          type="submit"
          text={submitting ? "Emitiendo…" : "Emitir remito"}
          icon={<Send size={16} />}
          disabled={submitting || Boolean(blockingReason)}
          title={blockingReason ?? undefined}
          hideTextOnMobile={false}
          dataTestId="remito-emitir"
        />
      </div>

      <ModalMessage
        open={confirmOpen}
        title={clase ? `Emitir Remito ${clase}` : "Emitir remito"}
        message="Los remitos emitidos no se pueden modificar. ¿Confirmás la emisión?"
        acceptLabel="Emitir"
        onAccept={() => void emitir()}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        {description ? <p style={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: 20, marginTop: 16 },
  section: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden" as const,
  },
  sectionHeader: {
    padding: "14px 20px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: COLOR.TEXT.PRIMARY },
  sectionDescription: { margin: 0, fontSize: 13, color: COLOR.TEXT.SECONDARY },
  sectionBody: { padding: 20, display: "flex", flexDirection: "column" as const, gap: 12 },
  facturaBanner: { display: "flex", alignItems: "center", gap: 10, background: COLOR.BACKGROUND.INFO_TINT },
  link: { color: COLOR.ACCENT.PRIMARY, fontWeight: 600 },
  list: { margin: "6px 0", paddingLeft: 18 },
  errorAlert: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 8,
    color: COLOR.SEMANTIC.DANGER,
    background: COLOR.BACKGROUND.DANGER_TINT,
    fontSize: 13,
  },
  warningAlert: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 8,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.WARNING_TINT,
    border: `1px solid ${COLOR.SEMANTIC.WARNING}`,
    fontSize: 13,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
    paddingTop: 16,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  blockingReason: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
} as const;
