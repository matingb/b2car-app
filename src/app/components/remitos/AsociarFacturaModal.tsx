"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, ReceiptText } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import ModalMessage from "@/app/components/ui/ModalMessage";
import Dropdown from "@/app/components/ui/Dropdown";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { remitosClient } from "@/clients/remitosClient";
import { comprobanteLabel, type FacturaElectronicaResumen } from "@/lib/facturacion/types";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { excesosDeMapeo, sugerirMapeo } from "@/lib/remitos/remitoValidation";
import { formatRemitoCantidad, type RemitoDetalle, type RemitoFacturaLineaDisponible } from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  remito: RemitoDetalle;
  onClose: () => void;
  onAssociated: () => void;
};

/** Datos de la factura que se muestran: comprobante, número, fecha y receptor. Nunca el total. */
type FacturaOpcion = Pick<
  FacturaElectronicaResumen,
  "id" | "documentoTipo" | "claseComprobante" | "puntoVenta" | "numeroComprobante" | "fechaComprobante" | "receptorNombre" | "receptorDocumento"
>;

function facturaOpcion(factura: FacturaElectronicaResumen): FacturaOpcion {
  return {
    id: factura.id,
    documentoTipo: factura.documentoTipo,
    claseComprobante: factura.claseComprobante,
    puntoVenta: factura.puntoVenta,
    numeroComprobante: factura.numeroComprobante,
    fechaComprobante: factura.fechaComprobante,
    receptorNombre: factura.receptorNombre,
    receptorDocumento: factura.receptorDocumento,
  };
}

function facturaNumero(factura: FacturaOpcion) {
  return factura.numeroComprobante
    ? `${String(factura.puntoVenta).padStart(5, "0")}-${String(factura.numeroComprobante).padStart(8, "0")}`
    : "Sin número";
}

function soloDigitos(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export default function AsociarFacturaModal({ open, remito, onClose, onAssociated }: Props) {
  const [search, setSearch] = useState("");
  const [facturas, setFacturas] = useState<FacturaOpcion[]>([]);
  const [searching, setSearching] = useState(false);
  const [factura, setFactura] = useState<FacturaOpcion | null>(null);
  const [lineasFactura, setLineasFactura] = useState<RemitoFacturaLineaDisponible[] | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setFactura(null);
      setLineasFactura(null);
      setMapeo({});
      setConfirmOpen(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || factura) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const result = await remitosClient.buscarFacturasAsociables(remito.ambiente, search, controller.signal);
        setFacturas(result.items.map(facturaOpcion));
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "No se pudieron buscar las facturas");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, factura, remito.ambiente, search]);

  const elegirFactura = async (opcion: FacturaOpcion) => {
    setFactura(opcion);
    setLineasFactura(null);
    setError(null);
    try {
      const data = await remitosClient.getFacturaRemitos(opcion.id);
      setLineasFactura(data.lineas);
      setMapeo(sugerirMapeo(remito.lineas, data.lineas));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las líneas de la factura");
    }
  };

  const excesos = useMemo(
    () => (lineasFactura ? excesosDeMapeo(remito.lineas, mapeo, lineasFactura) : {}),
    [lineasFactura, mapeo, remito.lineas],
  );
  const sinMapear = remito.lineas.filter((linea) => !mapeo[linea.id]).length;
  const hayExcesos = Object.keys(excesos).length > 0;
  const documentoDistinto = Boolean(factura)
    && Boolean(soloDigitos(remito.destinatario.numeroDocumento))
    && soloDigitos(remito.destinatario.numeroDocumento) !== soloDigitos(factura?.receptorDocumento);
  const canSubmit = Boolean(factura && lineasFactura) && sinMapear === 0 && !hayExcesos && !submitting;

  const opcionesLineas = useMemo(() => [
    { value: "", label: "Seleccioná una línea" },
    ...(lineasFactura ?? []).map((linea) => ({
      value: linea.id,
      label: `${linea.codigo ? `${linea.codigo} · ` : ""}${linea.descripcion} (disp. ${formatRemitoCantidad(linea.cantidadDisponible)})`,
    })),
  ], [lineasFactura]);

  const asociar = async () => {
    if (!factura) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      await remitosClient.asociar(remito.id, {
        facturaId: factura.id,
        lineas: remito.lineas.map((linea) => ({ remitoLineaId: linea.id, facturaLineaId: mapeo[linea.id] })),
      });
      onAssociated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asociar el remito");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={`Asociar ${remito.numeroVisible} a una factura`}
        onClose={() => !submitting && onClose()}
        onSubmit={() => { if (canSubmit) setConfirmOpen(true); }}
        submitText="Asociar"
        submittingText="Asociando…"
        submitting={submitting}
        disabledSubmit={!canSubmit}
        modalStyle={{ width: "min(760px, 94vw)", overflowY: "auto" }}
        modalError={error ? { titulo: "No se pudo completar la asociación", descripcion: error } : null}
        showCloseButton
      >
        {!factura ? (
          <div style={styles.step}>
            <p style={styles.muted}>Buscá una factura autorizada del mismo ambiente. El remito queda vinculado una sola vez.</p>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por número, receptor o documento..."
              ariaLabel="Buscar factura"
              style={{ height: 40 }}
            />
            {searching ? <ListSkeleton rows={3} /> : null}
            {!searching && facturas.length === 0 ? <p style={styles.muted}>No hay facturas autorizadas para esta búsqueda.</p> : null}
            {!searching ? (
              <div style={styles.facturas} role="list">
                {facturas.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    role="listitem"
                    onClick={() => void elegirFactura(opcion)}
                    style={styles.facturaOption}
                    data-testid={`asociar-factura-${opcion.id}`}
                  >
                    <ReceiptText size={18} color={COLOR.ACCENT.PRIMARY} />
                    <span style={styles.facturaText}>
                      <strong>{comprobanteLabel(opcion.documentoTipo, opcion.claseComprobante)} {facturaNumero(opcion)}</strong>
                      <span style={styles.muted}>
                        {formatCalendarDateLabel(opcion.fechaComprobante, "-")} · {opcion.receptorNombre} · {opcion.receptorDocumento ?? "Sin documento"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={styles.step}>
            <button type="button" style={styles.back} onClick={() => setFactura(null)} disabled={submitting}>
              <ArrowLeft size={14} /> Elegir otra factura
            </button>
            <p style={{ margin: 0 }}>
              <strong>{comprobanteLabel(factura.documentoTipo, factura.claseComprobante)} {facturaNumero(factura)}</strong>
              <span style={styles.muted}> · {factura.receptorNombre}</span>
            </p>
            {documentoDistinto ? (
              <div role="note" style={styles.warning} data-testid="asociar-documento-distinto">
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                El documento del destinatario del remito no coincide con el receptor de la factura. Podés asociarlo igual.
              </div>
            ) : null}
            {!lineasFactura && !error ? <ListSkeleton rows={3} /> : null}
            {lineasFactura ? (
              <div style={styles.mapeo}>
                <p style={styles.muted}>Indicá a qué línea de la factura corresponde cada ítem del remito.</p>
                {remito.lineas.map((linea) => {
                  const destino = mapeo[linea.id] ?? "";
                  const exceso = destino ? excesos[destino] : undefined;
                  return (
                    <div key={linea.id} style={styles.mapeoRow}>
                      <div style={styles.mapeoItem}>
                        <strong>{linea.descripcion}</strong>
                        <span style={styles.muted}>
                          {linea.codigo ? `${linea.codigo} · ` : ""}Cantidad {formatRemitoCantidad(linea.cantidad)}
                        </span>
                      </div>
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <Dropdown
                          value={destino}
                          options={opcionesLineas}
                          onChange={(value) => setMapeo((current) => ({ ...current, [linea.id]: value }))}
                          style={{ width: "100%", height: 40 }}
                          dataTestId={`asociar-mapeo-${linea.id}`}
                          disabled={submitting}
                        />
                        {exceso ? (
                          <span style={styles.error} role="alert">
                            Supera la cantidad disponible de la línea por {formatRemitoCantidad(exceso)}.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {sinMapear > 0 ? <span style={styles.muted}>Faltan asociar {sinMapear} ítem{sinMapear === 1 ? "" : "s"}.</span> : null}
              </div>
            ) : null}
          </div>
        )}
      </Modal>
      {confirmOpen && typeof document !== "undefined" ? createPortal(
        <ModalMessage
          open
          title="Confirmar asociación"
          message="La asociación no modifica el remito y no puede deshacerse. ¿Querés continuar?"
          acceptLabel="Asociar"
          onAccept={() => void asociar()}
          onCancel={() => setConfirmOpen(false)}
        />,
        document.body,
      ) : null}
    </>
  );
}

const styles = {
  step: { display: "flex", flexDirection: "column" as const, gap: 12, marginTop: 8 },
  muted: { margin: 0, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  facturas: { display: "flex", flexDirection: "column" as const, gap: 8, maxHeight: 360, overflowY: "auto" as const },
  facturaOption: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left" as const,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
  },
  facturaText: { display: "flex", flexDirection: "column" as const, gap: 2, minWidth: 0 },
  back: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    border: "none",
    background: "transparent",
    color: COLOR.ACCENT.PRIMARY,
    cursor: "pointer",
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
  },
  warning: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.WARNING_TINT,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
  },
  mapeo: { display: "flex", flexDirection: "column" as const, gap: 10 },
  mapeoRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  mapeoItem: { display: "flex", flexDirection: "column" as const, gap: 2, flex: "1 1 200px", minWidth: 0 },
  error: { display: "block", marginTop: 4, color: COLOR.SEMANTIC.DANGER, fontSize: 12 },
} as const;
