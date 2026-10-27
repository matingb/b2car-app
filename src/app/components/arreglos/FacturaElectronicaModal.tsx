"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, ReceiptText, Settings2 } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import ModalMessage from "@/app/components/ui/ModalMessage";
import Button from "@/app/components/ui/Button";
import Calendar from "@/app/components/ui/Calendar";
import Dropdown from "@/app/components/ui/Dropdown";
import IconInput from "@/app/components/ui/IconInput";
import Toggle from "@/app/components/ui/Toggle";
import FacturaReceptorFields from "@/app/components/facturacion/FacturaReceptorFields";
import FacturaIssuesSummary, { facturaIssueId, uniqueFacturaIssues } from "@/app/components/facturacion/FacturaIssuesSummary";
import FacturaRevisionView, { type FacturaRevisionPdf } from "@/app/components/facturacion/FacturaRevisionView";
import { clienteReceptorState, type ReceptorState } from "@/app/components/facturacion/facturaReceptorDraft";
import { FACTURA_CAMPO_INPUT_ID, validateFacturaForm } from "@/app/components/facturacion/facturaFormValidation";
import { isArcaInscriptionLookupReady, normalizeArcaCuit } from "@/app/hooks/useArcaInscriptionLookup";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { importeLineaMostrado } from "@/lib/facturacion/lineaImporte";
import { determineVoucher } from "@/lib/facturacion/arcaPayload";
import { ROUTES } from "@/routing/routes";
import {
  DETALLE_SIMPLIFICADO_DESCRIPCION_DEFAULT,
  DETALLE_SIMPLIFICADO_DESCRIPCION_MAX,
  type CondicionIvaReceptorId,
  type FacturaElectronicaResumen,
  type FacturaFechaInput,
  type FacturaIssue,
  type FacturaReceptorPrecarga,
  type FacturaRevision,
  type FacturacionPreflight,
} from "@/lib/facturacion/types";

type Props = {
  open: boolean;
  arregloId?: string;
  operacionId?: string;
  onClose: () => void;
  onAuthorized: (factura: FacturaElectronicaResumen) => void;
};

/** Datos del comprobante que se revisan y, una vez confirmados, se emiten sin cambios. */
type FacturaDraftBody = {
  condicionVenta: string;
  detalleSimplificado: boolean;
  descripcionDetalleSimplificado?: string;
  receptor: {
    modo: "CLIENTE" | "OTRO";
    nombre: string;
    domicilio: string | null;
    tipoDocumento: number;
    numeroDocumento: string;
    condicionIvaReceptorId: number | null;
  };
  fechas: FacturaFechaInput;
  fceSistema: "SCA" | "ADC" | null;
};

type Paso = "EDICION" | "REVISION";

const PREVIEW_ENDPOINT = "/api/facturacion/previsualizacion";
const PREVIEW_PDF_ENDPOINT = "/api/facturacion/previsualizacion/pdf";
const RECEPTOR_ENDPOINT = "/api/facturacion/receptor";
const JSON_HEADERS = { "Content-Type": "application/json" };
const EMPTY_RECEPTOR = clienteReceptorState({
  clienteId: null, nombre: "", domicilio: null, tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5,
});
const condicionVentaOptions = [
  { value: "CONTADO", label: "Contado" },
  { value: "TARJETA DE DEBITO", label: "Tarjeta de débito" },
  { value: "TARJETA DE CREDITO", label: "Tarjeta de crédito" },
  { value: "CUENTA CORRIENTE", label: "Cuenta corriente" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TRANSFERENCIA BANCARIA", label: "Transferencia bancaria" },
  { value: "OTRA", label: "Otra" },
];

function generalIssue(codigo: string, mensaje: string, grupo: FacturaIssue["grupo"] = "EMISION"): FacturaIssue {
  return { codigo, grupo, mensaje, severidad: "error" };
}

export default function FacturaElectronicaModal({ open, arregloId, operacionId, onClose, onAuthorized }: Props) {
  const router = useRouter();
  const [preflight, setPreflight] = useState<FacturacionPreflight | null>(null);
  const [factura, setFactura] = useState<FacturaElectronicaResumen | null>(null);
  const [precarga, setPrecarga] = useState<ReceptorState>(EMPTY_RECEPTOR);
  const [receptor, setReceptor] = useState<ReceptorState>(EMPTY_RECEPTOR);
  const [condicionVenta, setCondicionVenta] = useState("CONTADO");
  const [fceSistema, setFceSistema] = useState<"SCA" | "ADC" | "">("");
  const [fechas, setFechas] = useState<FacturaFechaInput>({ fechaComprobante: "" });
  const [detalleSimplificado, setDetalleSimplificado] = useState(false);
  const [descripcionSimplificada, setDescripcionSimplificada] = useState(DETALLE_SIMPLIFICADO_DESCRIPCION_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receptorCarga, setReceptorCarga] = useState<{ status: "loading" | "ready" | "error"; error?: string }>({ status: "loading" });
  const [advertenciaReceptor, setAdvertenciaReceptor] = useState<string | undefined>(undefined);
  const [fceRefresh, setFceRefresh] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [paso, setPaso] = useState<Paso>("EDICION");
  const [revisando, setRevisando] = useState(false);
  const [revision, setRevision] = useState<{ data: FacturaRevision; request: FacturaDraftBody } | null>(null);
  const [pdf, setPdf] = useState<FacturaRevisionPdf>({ status: "loading", url: null });
  const [emitiendo, setEmitiendo] = useState(false);
  const [intentoRevision, setIntentoRevision] = useState(false);
  const [serverIssues, setServerIssues] = useState<FacturaIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [focusSummaryTick, setFocusSummaryTick] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const reviewSeq = useRef(0);
  const pdfSeq = useRef(0);
  const receptorSeq = useRef(0);
  const pdfUrlRef = useRef<string | null>(null);
  const authorizedRef = useRef<string | null>(null);
  const emitiendoRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const requestRevisionRef = useRef<(request: FacturaDraftBody, aviso?: string | null) => Promise<void>>(async () => {});

  const origenTipo = operacionId ? "VENTA" as const : "ARREGLO" as const;
  const origenId = operacionId ?? arregloId ?? "";
  const endpoint = operacionId ? `/api/operaciones/${operacionId}/factura` : `/api/arreglos/${arregloId}/factura`;
  const esArreglo = Boolean(arregloId && !operacionId);
  const entidadCerrada = operacionId ? "la venta quedará cerrada" : "el arreglo quedará cerrado";

  const releasePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
  }, []);

  useEffect(() => releasePdfUrl, [releasePdfUrl]);

  /** Datos fiscales del cliente: consultan ARCA y llegan aparte para no demorar el resto del formulario. */
  const loadReceptor = useCallback(async () => {
    const seq = ++receptorSeq.current;
    setReceptorCarga({ status: "loading" });
    try {
      const params = new URLSearchParams({ origenTipo, origenId });
      const response = await fetch(`${RECEPTOR_ENDPOINT}?${params.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (seq !== receptorSeq.current) return;
      if (!response.ok || !body.data) throw new Error(body.error || "No se pudieron obtener los datos del cliente.");
      const data = body.data as FacturaReceptorPrecarga;
      const inicial = clienteReceptorState(data.receptor);
      setPrecarga(inicial);
      // Si mientras tanto se eligió otro receptor, se respeta lo cargado.
      setReceptor((current) => current.draft.modo === "CLIENTE" ? inicial : current);
      setAdvertenciaReceptor(data.advertenciaArcaReceptor);
      setReceptorCarga({ status: "ready" });
    } catch (cause) {
      if (seq !== receptorSeq.current) return;
      setReceptorCarga({ status: "error", error: cause instanceof Error ? cause.message : "No se pudieron obtener los datos del cliente." });
    }
  }, [origenId, origenTipo]);

  useEffect(() => {
    if (!open) {
      // Una respuesta tardía de una revisión cerrada no debe volver a mostrarse.
      reviewSeq.current += 1;
      pdfSeq.current += 1;
      receptorSeq.current += 1;
      releasePdfUrl();
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setError(null);
    setPreflight(null);
    setFactura(null);
    setPrecarga(EMPTY_RECEPTOR);
    setReceptor(EMPTY_RECEPTOR);
    setAdvertenciaReceptor(undefined);
    void loadReceptor();
    setPaso("EDICION");
    setRevision(null);
    setRevisando(false);
    setPdf({ status: "loading", url: null });
    setServerIssues([]);
    setIntentoRevision(false);
    setIdempotencyKey(crypto.randomUUID());
    authorizedRef.current = null;
    // El resto del formulario no espera a ARCA: el receptor del cliente se pide aparte.
    fetch(`${endpoint}?receptor=diferido`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo preparar la factura electrónica");
        if (cancelled) return;
        const data = body.data as { factura: FacturaElectronicaResumen | null; preflight: FacturacionPreflight };
        setPreflight(data.preflight);
        setFactura(data.factura);
        setCondicionVenta("CONTADO");
        setFceSistema(data.preflight.fceSistemaConfigurado ?? "");
        setDetalleSimplificado(false);
        setDescripcionSimplificada(DETALLE_SIMPLIFICADO_DESCRIPCION_DEFAULT);
        setFechas(data.preflight.fechasDefault);
      })
      .catch((cause) => {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "No se pudo preparar la factura electrónica");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, loadReceptor, open, releasePdfUrl]);

  const hasPreflight = Boolean(preflight);
  const clientePendiente = receptor.draft.modo === "CLIENTE" && receptorCarga.status !== "ready";
  const fceCuit = receptor.draft.tipoDocumento === "80" && isArcaInscriptionLookupReady(receptor.draft.numeroDocumento)
    ? normalizeArcaCuit(receptor.draft.numeroDocumento)
    : "";
  // Orientativo mientras se edita: la revisión vuelve a determinar la obligación FCE.
  useEffect(() => {
    if (!open || !hasPreflight || paso !== "EDICION") return;
    if (!fceCuit) {
      setPreflight((current) => current && current.fcePosible ? { ...current, fcePosible: false, fceObligatoria: false } : current);
      setFceRefresh("ready");
      return;
    }
    const params = new URLSearchParams({ fechaComprobante: fechas.fechaComprobante, tipoDocumento: "80", numeroDocumento: fceCuit });
    let active = true;
    const controller = new AbortController();
    setFceRefresh("loading");
    const timer = window.setTimeout(() => {
      fetch(`${endpoint}?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "No se pudo actualizar la consulta de obligación FCE");
          if (!active) return;
          const refreshed = body.data.preflight as FacturacionPreflight;
          setPreflight((current) => current ? {
            ...current,
            fcePosible: refreshed.fcePosible,
            fceObligatoria: refreshed.fceObligatoria,
            fceFechaConsulta: refreshed.fceFechaConsulta,
            fceTotalConsultado: refreshed.fceTotalConsultado,
          } : current);
          setFceRefresh("ready");
        })
        .catch((cause) => {
          if (!active || (cause instanceof DOMException && cause.name === "AbortError")) return;
          setFceRefresh("error");
        });
    }, 250);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [open, hasPreflight, paso, endpoint, fechas.fechaComprobante, fceCuit]);

  const needsConfiguration = Boolean(preflight && !preflight.configuracionCompleta);
  const concepto = preflight?.concepto ?? 1;
  const fce = Boolean(preflight?.fcePosible);
  const condicionReceptor = receptor.draft.condicionIvaReceptorId
    ? Number(receptor.draft.condicionIvaReceptorId) as CondicionIvaReceptorId
    : null;
  const voucherPreview = useMemo(() => (
    preflight?.emisor && condicionReceptor ? determineVoucher(preflight.emisor.condicionIvaEmisor, condicionReceptor) : null
  ), [preflight?.emisor, condicionReceptor]);

  const draftBody = useMemo<FacturaDraftBody>(() => {
    const simplificado = esArreglo && detalleSimplificado;
    return {
      condicionVenta,
      detalleSimplificado: simplificado,
      ...(simplificado ? { descripcionDetalleSimplificado: descripcionSimplificada } : {}),
      receptor: {
        modo: receptor.draft.modo,
        nombre: receptor.draft.nombre,
        domicilio: receptor.draft.domicilio.trim() || null,
        tipoDocumento: Number(receptor.draft.tipoDocumento),
        numeroDocumento: receptor.draft.tipoDocumento === "99" ? "" : receptor.draft.numeroDocumento,
        condicionIvaReceptorId: condicionReceptor,
      },
      fechas: {
        fechaComprobante: fechas.fechaComprobante,
        fechaServicioDesde: fechas.fechaServicioDesde || null,
        fechaServicioHasta: fechas.fechaServicioHasta || null,
        fechaVencimientoPago: fechas.fechaVencimientoPago || null,
      },
      fceSistema: fceSistema || null,
    };
  }, [condicionReceptor, condicionVenta, descripcionSimplificada, detalleSimplificado, esArreglo, fceSistema, fechas, receptor.draft]);
  const draftKey = JSON.stringify(draftBody);

  // Los mensajes del servidor describen el formulario que se revisó; al editarlo dejan de aplicar.
  useEffect(() => { setServerIssues([]); }, [draftKey]);

  const estadoIssues = useMemo<FacturaIssue[]>(() => {
    if (!preflight) return [];
    const issues: FacturaIssue[] = [];
    if (factura?.estado === "AUTORIZADA") {
      issues.push(generalIssue("FACTURA_YA_AUTORIZADA", "El origen ya posee una factura autorizada."));
    } else if (factura?.estado === "ENVIANDO" || factura?.estado === "INCIERTA") {
      issues.push(generalIssue("EMISION_PENDIENTE", "La emisión quedó incierta. No se asignará otro número hasta reconciliar el comprobante candidato."));
    } else if (factura?.estado === "RECHAZADA") {
      issues.push({
        codigo: "EMISION_RECHAZADA", grupo: "EMISION", severidad: "advertencia",
        mensaje: `ARCA rechazó la emisión anterior${factura.errorMensaje ? `: ${factura.errorMensaje}` : ""}. Revisá los datos antes de reintentar.`,
      });
    }
    if (preflight.diferenciasTotal) {
      issues.push(generalIssue("DETALLE_INCONSISTENTE", preflight.mensaje ?? "No se pudo validar el detalle fiscal.", "DETALLE"));
    }
    if (fce && (!preflight.fceCbuConfigurado || !preflight.fceSistemaConfigurado)) {
      issues.push(generalIssue("FCE_SIN_CONFIGURAR", "Configurá el CBU fiscal y elegí el sistema SCA/ADC en Configuración antes de emitir FCE.", "CONFIGURACION"));
    }
    if (fceRefresh === "error") {
      issues.push({
        codigo: "FCE_NO_VERIFICADA", grupo: "CONFIGURACION", severidad: "advertencia",
        mensaje: "No se pudo verificar ahora la obligación FCE; se volverá a consultar al revisar la factura.",
      });
    }
    return issues;
  }, [factura?.errorMensaje, factura?.estado, fce, fceRefresh, preflight]);

  const formIssues = useMemo(() => (preflight ? validateFacturaForm({
    origenTipo,
    receptor: receptor.draft,
    clienteAsociado: preflight.clienteAsociado ?? null,
    condicionIvaEmisor: preflight.emisor?.condicionIvaEmisor ?? null,
    concepto,
    fechas,
    fce,
    detalleSimplificado: esArreglo && detalleSimplificado,
    descripcionDetalleSimplificado: descripcionSimplificada,
  }) : []), [concepto, descripcionSimplificada, detalleSimplificado, esArreglo, fce, fechas, origenTipo, preflight, receptor.draft]);

  // No se marca nada en rojo hasta el primer intento de revisar.
  const visibleIssues = useMemo(
    () => uniqueFacturaIssues([...estadoIssues, ...(intentoRevision ? formIssues : []), ...serverIssues]),
    [estadoIssues, formIssues, intentoRevision, serverIssues],
  );
  const invalidCampos = useMemo(
    () => new Set(visibleIssues.filter((issue) => issue.severidad === "error" && issue.campo).map((issue) => issue.campo!)),
    [visibleIssues],
  );
  const describedBy = useCallback((campo: string) => {
    const issue = visibleIssues.find((item) => item.severidad === "error" && item.campo === campo);
    return issue ? facturaIssueId(issue) : undefined;
  }, [visibleIssues]);

  useEffect(() => {
    if (focusSummaryTick) summaryRef.current?.focus();
  }, [focusSummaryTick]);

  const focusCampo = useCallback((campo: string) => {
    const id = FACTURA_CAMPO_INPUT_ID[campo];
    if (id) document.getElementById(id)?.focus();
  }, []);

  const loadPdf = useCallback(async (data: FacturaRevision, request: FacturaDraftBody, onOutdated: () => void) => {
    const seq = ++pdfSeq.current;
    releasePdfUrl();
    setPdf({ status: "loading", url: null });
    try {
      const response = await fetch(PREVIEW_PDF_ENDPOINT, {
        method: "POST",
        headers: JSON_HEADERS,
        cache: "no-store",
        body: JSON.stringify({ origenTipo, origenId, ...request, revisionHash: data.revisionHash }),
      });
      if (seq !== pdfSeq.current) return;
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (seq !== pdfSeq.current) return;
        if (body.code === "REVISION_DESACTUALIZADA") {
          onOutdated();
          return;
        }
        setPdf({ status: "error", url: null, error: body.error || "No se pudo generar la vista previa." });
        return;
      }
      const blob = await response.blob();
      if (seq !== pdfSeq.current) return;
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdf({ status: "ready", url });
    } catch {
      if (seq === pdfSeq.current) setPdf({ status: "error", url: null, error: "No se pudo generar la vista previa." });
    }
  }, [origenId, origenTipo, releasePdfUrl]);

  /** Pide la revisión del servidor; con éxito pasa al paso 2 y genera el PDF borrador. */
  const requestRevision = useCallback(async (request: FacturaDraftBody, aviso: string | null = null) => {
    const seq = ++reviewSeq.current;
    setRevisando(true);
    try {
      const response = await fetch(PREVIEW_ENDPOINT, {
        method: "POST",
        headers: JSON_HEADERS,
        cache: "no-store",
        body: JSON.stringify({ origenTipo, origenId, ...request }),
      });
      const body = await response.json().catch(() => ({}));
      if (seq !== reviewSeq.current) return;
      if (!response.ok || !body.data) {
        pdfSeq.current += 1;
        releasePdfUrl();
        setRevision(null);
        setPaso("EDICION");
        setServerIssues(body.issues?.length ? body.issues : [generalIssue("REVISION_NO_DISPONIBLE", body.error || "No se pudo revisar la factura.")]);
        setFocusSummaryTick((tick) => tick + 1);
        return;
      }
      const data = body.data as FacturaRevision;
      setRevision({ data, request });
      setPaso("REVISION");
      setError(aviso);
      void loadPdf(data, request, () => { void requestRevisionRef.current(request, OUTDATED_MESSAGE); });
    } catch {
      if (seq !== reviewSeq.current) return;
      setServerIssues([generalIssue("REVISION_NO_DISPONIBLE", "No se pudo revisar la factura. Reintentá en unos segundos.")]);
      setFocusSummaryTick((tick) => tick + 1);
    } finally {
      if (seq === reviewSeq.current) setRevisando(false);
    }
  }, [loadPdf, origenId, origenTipo, releasePdfUrl]);

  useEffect(() => { requestRevisionRef.current = requestRevision; }, [requestRevision]);

  const startReview = () => {
    if (!preflight || revisando || emitiendo || (clientePendiente && !needsConfiguration)) return;
    if (needsConfiguration) {
      onClose();
      router.push(ROUTES.configuracionFacturacion);
      return;
    }
    setIntentoRevision(true);
    setError(null);
    if ([...estadoIssues, ...formIssues].some((issue) => issue.severidad === "error")) {
      setFocusSummaryTick((tick) => tick + 1);
      return;
    }
    void requestRevision(draftBody);
  };

  /** Descarta la revisión y su PDF; el formulario conserva lo cargado. */
  const discardRevision = () => {
    reviewSeq.current += 1;
    pdfSeq.current += 1;
    releasePdfUrl();
    setRevision(null);
    setRevisando(false);
    setError(null);
    setPaso("EDICION");
  };

  const volverAEditar = () => {
    if (!emitiendo) discardRevision();
  };

  const confirmar = async () => {
    if (!revision || emitiendoRef.current || revisando || pdf.status === "loading") return;
    emitiendoRef.current = true;
    setEmitiendo(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...revision.request,
          idempotencyKey,
          revisionHash: revision.data.revisionHash,
          fcePreflightConfirmada: revision.data.fce !== null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      const issued = body.data as FacturaElectronicaResumen | undefined;
      if (issued) setFactura(issued);
      if (issued?.estado === "AUTORIZADA") {
        if (authorizedRef.current !== issued.id) {
          authorizedRef.current = issued.id;
          onAuthorized(issued);
        }
        return;
      }
      if (body.code === "REVISION_DESACTUALIZADA" || body.code === "FCE_DATA_REQUIRED") {
        await requestRevision(revision.request, OUTDATED_MESSAGE);
        return;
      }
      if (issued?.estado === "RECHAZADA") {
        // Un reintento usa otra clave y vuelve a pasar por la revisión.
        setIdempotencyKey(crypto.randomUUID());
        discardRevision();
        setServerIssues([generalIssue("EMISION_RECHAZADA", `ARCA rechazó la factura${body.error ? `: ${body.error}` : ""}. Revisá los datos y volvé a revisar antes de reintentar.`)]);
        setFocusSummaryTick((tick) => tick + 1);
        return;
      }
      if (issued?.estado === "ENVIANDO" || issued?.estado === "INCIERTA") {
        setError(body.error || "La emisión quedó incierta. No se asignará otro número hasta reconciliar el comprobante candidato.");
        return;
      }
      if (!response.ok && response.status === 422 && body.issues?.length) {
        discardRevision();
        setServerIssues(body.issues);
        setFocusSummaryTick((tick) => tick + 1);
        return;
      }
      if (!response.ok) setError(body.error || "La emisión fiscal no fue autorizada");
    } catch {
      // La clave se conserva: reintentar no puede generar otra emisión.
      setError("No se pudo confirmar la emisión. Si reintentás se usará la misma solicitud, sin duplicar la factura.");
    } finally {
      emitiendoRef.current = false;
      setEmitiendo(false);
    }
  };

  const invoiceLabel = useMemo(() => {
    if (!factura?.numeroComprobante) return "";
    return `${String(factura.puntoVenta).padStart(5, "0")}-${String(factura.numeroComprobante).padStart(8, "0")}`;
  }, [factura?.numeroComprobante, factura?.puntoVenta]);

  const ivaTotal = preflight?.totales?.iva ?? 0;
  const preciosSinIva = preflight?.preciosIncluyenIva === false && ivaTotal > 0;
  const emisionPendiente = factura?.estado === "ENVIANDO" || factura?.estado === "INCIERTA";

  const downloadPdf = () => {
    if (!factura?.id) return;
    const anchor = document.createElement("a");
    anchor.href = `/api/facturas/${factura.id}/pdf`;
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onClose();
  };

  const fechaProps = (campo: keyof FacturaFechaInput) => {
    const key = `fechas.${campo}`;
    return {
      id: FACTURA_CAMPO_INPUT_ID[key],
      dataTestId: FACTURA_CAMPO_INPUT_ID[key],
      value: fechas[campo] ?? "",
      onChange: (value: string) => setFechas((previous) => ({ ...previous, [campo]: value })),
      invalid: invalidCampos.has(key),
      ariaDescribedBy: describedBy(key),
      disabled: revisando,
      clearable: true,
      style: styles.dateTrigger,
    };
  };

  const title = needsConfiguration
    ? "Facturación electrónica sin configurar"
    : paso === "REVISION" ? "Revisar factura antes de emitir" : "Facturación electrónica";

  return (
    <>
    <Modal
      open={open && factura?.estado !== "AUTORIZADA"}
      title={title}
      onClose={onClose}
      submitting={emitiendo}
      wrapInForm={false}
      modalStyle={styles.modal}
    >
      {loading ? (
        <>
          <p style={styles.muted}>Preparando datos fiscales…</p>
          <div style={styles.footer}>
            <Button type="button" text="Cancelar" outline hideTextOnMobile={false} onClick={onClose} dataTestId="modal-cancel" />
          </div>
        </>
      ) : null}
      {!loading && loadError ? (
        <>
          <div style={styles.errorBox} role="alert" data-testid="modal-error">
            <strong>No se pudo preparar la factura</strong>
            <span>{loadError}</span>
          </div>
          <div style={styles.footer}>
            <Button type="button" text="Cerrar" outline hideTextOnMobile={false} onClick={onClose} dataTestId="modal-cancel" />
          </div>
        </>
      ) : null}
      {!loading && needsConfiguration ? (
        <>
          <div style={styles.configurationContent}>
            <div style={styles.configurationIcon}><Settings2 size={24} /></div>
            <div style={styles.configurationText}>
              <strong>Antes de emitir un comprobante, configurá la facturación electrónica.</strong>
              <span>
                Completá los datos fiscales y cargá el certificado junto con su clave privada para poder emitir con ARCA.
              </span>
            </div>
          </div>
          <div style={styles.footer}>
            <Button type="button" text="Cancelar" outline hideTextOnMobile={false} onClick={onClose} dataTestId="modal-cancel" />
            <Button type="button" text="Configurar facturación" hideTextOnMobile={false} onClick={startReview} dataTestId="modal-submit" />
          </div>
        </>
      ) : null}

      {!loading && preflight && !needsConfiguration && paso === "EDICION" ? (
        <form
          noValidate
          style={styles.content}
          // Enter en un input sólo puede iniciar la revisión; nunca emite.
          onSubmit={(event) => { event.preventDefault(); startReview(); }}
        >
          <span style={styles.step}>Paso 1 de 2 · Completá los datos de la factura</span>
          <FacturaReceptorFields
            origenTipo={origenTipo}
            value={receptor}
            onChange={setReceptor}
            precarga={precarga}
            clienteAsociado={preflight.clienteAsociado ?? null}
            advertenciaPrecarga={advertenciaReceptor}
            lookupsEnabled={open && paso === "EDICION"}
            disabled={revisando}
            invalidCampos={invalidCampos}
            describedBy={describedBy}
            cargandoCliente={receptorCarga.status === "loading"}
            errorCliente={receptorCarga.status === "error" ? receptorCarga.error ?? null : null}
            onRetryCliente={() => { void loadReceptor(); }}
          />

          <section style={styles.section}>
            <div style={styles.sectionTitle}>Datos del comprobante</div>
            <div style={styles.summary} aria-label="Resumen fiscal">
              <div style={styles.summaryItem}>
                <div style={styles.summaryIcon}><ReceiptText size={17} /></div>
                <div style={styles.summaryText}>
                  <span style={styles.label}>Tipo de comprobante</span>
                  <strong>
                    {fce ? "Factura de Crédito Electrónica MiPyME" : "Factura"} {voucherPreview?.clase ?? preflight.claseComprobante}
                  </strong>
                  <span style={styles.summaryDetail}>
                    Concepto {concepto}: {concepto === 1 ? "productos" : concepto === 2 ? "servicios" : "productos y servicios"} · se confirma al revisar
                  </span>
                </div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryText}>
                  <span style={styles.label}>Emisor</span>
                  <strong>{preflight.emisor?.razonSocial ?? "Configuración pendiente"}</strong>
                  <span style={styles.summaryDetail}>{preflight.emisor?.cuit ?? ""} · Punto de venta {preflight.emisor?.puntoVenta ?? "-"}</span>
                </div>
              </div>
            </div>
            <div style={styles.comprobanteRow}>
              <div style={styles.field}>
                <label htmlFor={FACTURA_CAMPO_INPUT_ID.condicionVenta} style={styles.fieldLabel}>Condición de venta</label>
                <Dropdown
                  id={FACTURA_CAMPO_INPUT_ID.condicionVenta}
                  ariaLabel="Condición de venta"
                  options={condicionVentaOptions}
                  value={condicionVenta}
                  onChange={setCondicionVenta}
                  disabled={revisando}
                  style={styles.dropdown}
                  dataTestId="factura-condicion-venta"
                />
              </div>
              <div style={styles.field}>
                <label htmlFor={FACTURA_CAMPO_INPUT_ID["fechas.fechaComprobante"]} style={styles.fieldLabel}>Fecha del comprobante</label>
                <Calendar {...fechaProps("fechaComprobante")} />
              </div>
            </div>
            {concepto !== 1 || fce ? (
              <div style={styles.periodoRow} data-testid="factura-fechas-periodo">
                {concepto !== 1 ? (
                  <>
                    <div style={styles.field}>
                      <label htmlFor={FACTURA_CAMPO_INPUT_ID["fechas.fechaServicioDesde"]} style={styles.fieldLabel}>Servicio desde</label>
                      <Calendar {...fechaProps("fechaServicioDesde")} />
                    </div>
                    <div style={styles.field}>
                      <label htmlFor={FACTURA_CAMPO_INPUT_ID["fechas.fechaServicioHasta"]} style={styles.fieldLabel}>Servicio hasta</label>
                      <Calendar {...fechaProps("fechaServicioHasta")} />
                    </div>
                  </>
                ) : null}
                <div style={styles.field}>
                  <label htmlFor={FACTURA_CAMPO_INPUT_ID["fechas.fechaVencimientoPago"]} style={styles.fieldLabel}>Vencimiento de pago</label>
                  <Calendar {...fechaProps("fechaVencimientoPago")} />
                </div>
              </div>
            ) : null}
            {fce ? (
              <div style={styles.fceBox}>
                <strong>Factura de Crédito Electrónica MiPyME</strong>
                <span style={styles.summaryDetail}>
                  ARCA indica que esta operación requiere FCE. Se usará el sistema configurado para la empresa y el estado posterior se gestiona en el Registro FCE de ARCA.
                </span>
                <span>{fceSistema === "ADC" ? "ADC — Agente de Depósito Colectivo" : fceSistema === "SCA" ? "SCA — Sistema de Circulación Abierta" : "Elegí el sistema de circulación en Configuración de facturación"}</span>
              </div>
            ) : null}
          </section>

          <section style={styles.section}>
            <div style={styles.sectionTitle}>Detalle e importes</div>
            {esArreglo ? (
              <>
                <span style={styles.summaryDetail}>
                  Precios del arreglo: {preflight.preciosIncluyenIva === false ? "sin IVA incluido" : "con IVA incluido"}. Se modifica desde Editar arreglo.
                </span>
                <div style={styles.simplifiedDetail}>
                  <Toggle
                    checked={detalleSimplificado}
                    onChange={setDetalleSimplificado}
                    label="Simplificar el detalle de la factura"
                    disabled={revisando}
                  />
                  <span>Simplificar el detalle de la factura</span>
                </div>
                {detalleSimplificado ? (
                  <div style={styles.field}>
                    <label htmlFor={FACTURA_CAMPO_INPUT_ID["detalle.descripcion"]} style={styles.fieldLabel}>
                      Descripción que aparecerá en la factura
                    </label>
                    <IconInput
                      id={FACTURA_CAMPO_INPUT_ID["detalle.descripcion"]}
                      icon={null}
                      value={descripcionSimplificada}
                      maxLength={DETALLE_SIMPLIFICADO_DESCRIPCION_MAX}
                      disabled={revisando}
                      wrapperStyle={styles.inputWrapper}
                      data-testid="factura-detalle-descripcion"
                      invalid={invalidCampos.has("detalle.descripcion")}
                      aria-invalid={invalidCampos.has("detalle.descripcion") || undefined}
                      aria-describedby={describedBy("detalle.descripcion") ?? "factura-detalle-descripcion-ayuda"}
                      onChange={(event) => setDescripcionSimplificada(event.target.value)}
                    />
                    <span id="factura-detalle-descripcion-ayuda" style={styles.hint}>
                      {descripcionSimplificada.length}/{DETALLE_SIMPLIFICADO_DESCRIPCION_MAX} · Los importes, el IVA y el stock se calculan con el detalle original.
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}
            <div style={styles.detail} aria-label="Detalle a facturar">
              <div style={styles.lines}>
                {detalleSimplificado && esArreglo ? (
                  <div style={styles.line}>
                    <span style={styles.lineText}>{descripcionSimplificada.trim() || DETALLE_SIMPLIFICADO_DESCRIPCION_DEFAULT} × 1</span>
                    <strong>{formatArs(preciosSinIva ? preflight.total - ivaTotal : preflight.total, { minDecimals: 2 })}</strong>
                  </div>
                ) : preflight.lineas.map((linea) => (
                  <div style={styles.line} key={`${linea.origen}-${linea.ordinal}`}>
                    <span style={styles.lineText}>{linea.descripcion}{linea.codigo ? ` (${linea.codigo})` : ""} × {linea.cantidad}</span>
                    <strong>{formatArs(importeLineaMostrado(linea), { minDecimals: 2 })}</strong>
                  </div>
                ))}
              </div>
              {preciosSinIva ? (
                <>
                  <div style={styles.subtotal}><span>Subtotal</span><span>{formatArs(preflight.total - ivaTotal, { minDecimals: 2 })}</span></div>
                  <div style={styles.subtotal}><span>IVA</span><span>{formatArs(ivaTotal, { minDecimals: 2 })}</span></div>
                </>
              ) : null}
              <div style={styles.total}><span>Total a facturar</span><strong style={styles.totalAmount}>{formatArs(preflight.total, { minDecimals: 2 })}</strong></div>
            </div>
          </section>

          <FacturaIssuesSummary ref={summaryRef} issues={visibleIssues} onSelectCampo={focusCampo} />

          <div style={styles.footer}>
            <Button type="button" text="Cancelar" outline hideTextOnMobile={false} onClick={onClose} disabled={revisando} dataTestId="modal-cancel" />
            <Button
              type="submit"
              text={revisando
                ? "Preparando revisión…"
                : clientePendiente
                  ? receptorCarga.status === "loading" ? "Cargando datos del cliente…" : "Datos del cliente no disponibles"
                  : "Revisar factura"}
              hideTextOnMobile={false}
              disabled={revisando || clientePendiente}
              dataTestId="modal-submit"
            />
          </div>
        </form>
      ) : null}

      {!loading && preflight && !needsConfiguration && paso === "REVISION" && revision ? (
        <div style={styles.content}>
          <span style={styles.step}>Paso 2 de 2 · Revisá la vista previa antes de emitir</span>
          <FacturaRevisionView
            revision={revision.data}
            pdf={pdf}
            onRetryPdf={() => { void loadPdf(revision.data, revision.request, () => { void requestRevisionRef.current(revision.request, OUTDATED_MESSAGE); }); }}
          />
          <div style={styles.immutability}>
            <CircleAlert size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Al emitir la factura, {entidadCerrada} y no admitirá ningún tipo de modificación.</span>
          </div>
          {error ? (
            <div style={styles.errorBox} role="alert" data-testid="modal-error">
              <strong>{emisionPendiente ? "Emisión pendiente de reconciliación" : "Revisá antes de emitir"}</strong>
              <span>{error}</span>
            </div>
          ) : null}
          <div style={styles.footer}>
            <Button type="button" text="Volver a editar" outline hideTextOnMobile={false} onClick={volverAEditar} disabled={emitiendo} dataTestId="factura-volver-editar" />
            <Button type="button" text="Cancelar" outline hideTextOnMobile={false} onClick={onClose} disabled={emitiendo} dataTestId="modal-cancel" />
            <Button
              type="button"
              text={emitiendo ? "Emitiendo…" : revisando ? "Actualizando revisión…" : pdf.status === "loading" ? "Generando vista previa…" : "Confirmar y emitir"}
              hideTextOnMobile={false}
              onClick={() => { void confirmar(); }}
              disabled={emitiendo || revisando || pdf.status === "loading" || emisionPendiente}
              dataTestId="factura-confirmar-emitir"
            />
          </div>
        </div>
      ) : null}
    </Modal>
    <ModalMessage
      open={open && factura?.estado === "AUTORIZADA"}
      title="Factura creada"
      message={
        <div style={styles.createdMessage}>
          <p style={{ margin: 0 }}>La factura se creó satisfactoriamente.</p>
          <strong>{factura && [201, 206, 211].includes(factura.tipoComprobante) ? "Factura de Crédito Electrónica MiPyME" : `Factura ${factura?.claseComprobante ?? ""}`} {invoiceLabel}</strong>
          <p style={{ margin: 0 }}>¿Querés descargar el PDF de la factura?</p>
        </div>
      }
      acceptLabel="Descargar PDF"
      cancelLabel="Ahora no"
      onAccept={downloadPdf}
      onCancel={onClose}
    />
    </>
  );
}

const OUTDATED_MESSAGE = "Los datos cambiaron desde la revisión anterior. Revisá el comprobante actualizado antes de emitir.";

const styles = {
  modal: {
    width: "min(1020px, 96vw)",
    maxHeight: "90dvh",
    overflowY: "auto" as const,
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "18px 18px 0",
  },
  content: { display: "flex", flexDirection: "column" as const, gap: 18 },
  step: { color: COLOR.TEXT.TERTIARY, fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
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
    gap: 12,
    padding: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  summaryItem: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
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
  summaryDetail: { color: COLOR.TEXT.SECONDARY, fontSize: 13, lineHeight: 1.4 },
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingBottom: 10,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
  },
  // Condición de venta y fecha en una fila; período de servicios y vencimiento en otra.
  comprobanteRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  periodoRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0 },
  fieldLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  hint: { color: COLOR.TEXT.TERTIARY, fontSize: 12, lineHeight: 1.4 },
  simplifiedDetail: { display: "flex", alignItems: "center", gap: 8, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  label: { display: "block", fontSize: 11, color: COLOR.TEXT.TERTIARY, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  muted: { color: COLOR.TEXT.SECONDARY, fontSize: 13, lineHeight: 1.4 },
  dropdown: { width: "100%", height: 42 },
  inputWrapper: { width: "100%" },
  dateTrigger: { height: 42, padding: "0 12px" },
  fceBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
  },
  detail: { border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: 14, background: COLOR.BACKGROUND.SUBTLE },
  lines: { display: "flex", flexDirection: "column" as const, gap: 8 },
  line: { display: "flex", justifyContent: "space-between", gap: 12, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  lineText: { minWidth: 0, overflowWrap: "anywhere" as const },
  subtotal: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  total: { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`, marginTop: 12, paddingTop: 12, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  totalAmount: { color: COLOR.ACCENT.PRIMARY, fontSize: 18 },
  immutability: { display: "flex", alignItems: "flex-start", gap: 8, background: COLOR.BACKGROUND.ALERT_TINT, border: `1px solid ${COLOR.SEMANTIC.ALERT}`, color: COLOR.SEMANTIC.WARNING, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.4 },
  errorBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    background: COLOR.BACKGROUND.DANGER_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "12px 14px",
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  // Las acciones quedan visibles al final del área con scroll sin tapar el contenido.
  footer: {
    position: "sticky" as const,
    bottom: 0,
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
    gap: 12,
    margin: "4px -18px 0",
    padding: "14px 18px 18px",
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  createdMessage: { display: "flex", flexDirection: "column" as const, gap: 12, color: COLOR.TEXT.PRIMARY },
} as const;
