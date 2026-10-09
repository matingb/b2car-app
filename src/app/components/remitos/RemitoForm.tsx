"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ReceiptText, Send } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useTenant } from "@/app/providers/TenantProvider";
import { remitosClient } from "@/clients/remitosClient";
import { Permission } from "@/lib/permissions";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import type { RemitoClase, RemitoPreflight } from "@/lib/remitos/types";
import { ROUTES } from "@/routing/routes";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
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
  onSubmittingChange?: (submitting: boolean) => void;
};

export default function RemitoForm({ facturaId, arregloId = null, onEmitted, onCancel, onSubmittingChange }: Props) {
  const { hasPermission } = useTenant();
  const [preflight, setPreflight] = useState<RemitoPreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clase, setClase] = useState<RemitoClase | null>(null);
  const [destinatario, setDestinatario] = useState<DestinatarioForm>(DESTINATARIO_VACIO);
  const [transportista, setTransportista] = useState<TransportistaForm>(TRANSPORTISTA_VACIO);
  const [observaciones, setObservaciones] = useState("");
  const [lineasLibres, setLineasLibres] = useState<LineaLibreForm[]>([]);
  // Se genera al montar, se reutiliza en reintentos y se renueva solo tras una emisión exitosa.
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateUuidV4());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await remitosClient.preflight(facturaId, arregloId);
      setPreflight(data);
      if (data.arreglo) {
        setDestinatario(destinatarioFormDesde(data.arreglo.destinatario));
        setObservaciones(data.arreglo.facturaNumero ? `Factura asociada: ${data.arreglo.facturaNumero}` : "");
        setLineasLibres(data.factura ? seleccionInicial(data.factura.lineas) : data.arreglo.lineas.map((linea) => nuevaLineaLibre({
          codigo: linea.codigo ?? "",
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
        })));
      } else if (data.factura) {
        setDestinatario(destinatarioFormDesde(data.factura.destinatario));
        setLineasLibres(seleccionInicial(data.factura.lineas));
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
    if (destinatario.numeroDocumento.trim() && !destinatario.tipoDocumento) {
      return "Ingresá un DNI de 7 u 8 dígitos o un CUIT/CUIL de 11 dígitos.";
    }
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
    if (!clase || blockingReason || submitting) return;
    setSubmitting(true);
    onSubmittingChange?.(true);
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
      onSubmittingChange?.(false);
    }
  };

  if (loading) {
    return (
      <p role="status" style={{ color: COLOR.TEXT.SECONDARY, padding: "24px 0" }}>
        Cargando remito…
      </p>
    );
  }
  if (!preflight) {
    return <div role="alert" style={styles.errorAlert}><AlertCircle size={18} />{loadError ?? "No se pudo preparar el remito"}</div>;
  }

  const canConfigure = hasPermission(Permission.ConfiguracionView);
  const fiscalConfigLink = canConfigure ? (
    <Link href={ROUTES.configuracionFacturacion} style={styles.link}>Ir a Configuración &gt; Facturación</Link>
  ) : null;
  const remitosConfigLink = canConfigure ? (
    <Link href={ROUTES.configuracionRemitos} style={styles.link}>Ir a Configuración &gt; Remitos</Link>
  ) : null;

  return (
    <form
      style={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void emitir();
      }}
    >
      {!preflight.emisor.completo ? (
        <div role="alert" style={styles.errorAlert}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Faltan datos fiscales del emisor.</strong> Completá: {preflight.emisor.faltantes.join(", ")}.{" "}
            {fiscalConfigLink}
          </div>
        </div>
      ) : null}

      {factura ? (
        <div style={styles.facturaReference}>
          <ReceiptText size={18} color={COLOR.ACCENT.PRIMARY} />
          <span>
            Remito generado desde <Link href={`/facturacion/${factura.id}`} style={styles.link}>{factura.label}</Link>
            {factura.fechaComprobante ? ` del ${formatCalendarDateLabel(factura.fechaComprobante)}` : ""}
          </span>
        </div>
      ) : null}

      <div style={styles.fieldGroup}>
        <label htmlFor="remito-tipo" style={styles.label}>
          Tipo de remito <span style={styles.required}>*</span>
        </label>
        <RemitoTipoSelector value={clase} onChange={setClase} />
        {clase === "R" && !preflight.tipos.R.emitible ? (
          <div role="alert" style={styles.warningAlert} data-testid="remito-r-motivos">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Para emitir un Remito R falta completar la configuración:</strong>
              <ul style={styles.list}>
                {preflight.tipos.R.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}
              </ul>
              {remitosConfigLink}
            </div>
          </div>
        ) : null}
      </div>

      <div style={styles.fieldGroup}>
        <h3 style={styles.groupTitle}>Destinatario</h3>
        <RemitoDestinatarioFields value={destinatario} onChange={setDestinatario} disabled={submitting} />
      </div>

      <RemitoTransportistaFields value={transportista} onChange={setTransportista} disabled={submitting} />

      {factura ? (
        <RemitoFacturaLineasSelector lineas={factura.lineas} value={lineasLibres} onChange={setLineasLibres} disabled={submitting} />
      ) : (
        <RemitoLineasEditor value={lineasLibres} onChange={setLineasLibres} disabled={submitting} />
      )}

      <label style={styles.fieldGroup}>
        <span style={styles.label}>Observaciones</span>
        <textarea
          aria-label="Observaciones"
          maxLength={1000}
          value={observaciones}
          disabled={submitting}
          onChange={(event) => setObservaciones(event.target.value)}
          placeholder="Observaciones"
          style={remitoFormStyles.textarea}
        />
      </label>

      {error ? <div role="alert" style={styles.errorAlert}><AlertCircle size={18} style={{ flexShrink: 0 }} />{error}</div> : null}

      <div style={styles.actions}>
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

    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: 20, marginTop: 16 },
  fieldGroup: { display: "flex", flexDirection: "column" as const, gap: 10 },
  groupTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: COLOR.TEXT.PRIMARY },
  label: { fontSize: 13, fontWeight: 500, color: COLOR.TEXT.SECONDARY },
  required: { color: REQUIRED_ICON_COLOR, fontWeight: 700 },
  facturaReference: { display: "flex", alignItems: "center", gap: 10, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
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
} as const;
