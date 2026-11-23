"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import { Info, Plus, Trash2 } from "lucide-react";
import Calendar from "@/app/components/ui/Calendar";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import IconButton from "@/app/components/ui/IconButton";
import Dropdown from "@/app/components/ui/Dropdown";
import Autocomplete from "@/app/components/ui/Autocomplete";
import NumberInput from "@/app/components/ui/NumberInput";
import { FacturaIvaPorAlicuota, OperacionPercepcionesEditor } from "@/app/components/operaciones/OperacionFacturaPercepciones";
import { descripcionConceptoFactura, type ConceptoFactura } from "@/app/components/operaciones/useFacturaCompraDraft";
import { useToast } from "@/app/providers/ToastProvider";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import { parseComprobanteRecibidoInput } from "@/lib/comprobantesRecibidos/input";
import {
  COMPROBANTE_RECIBIDO_TIPO_LABEL,
  CONDICIONES_IVA_PROVEEDOR,
  FACTURA_RECIBIDA_CLASES,
  MAX_LINEAS_COMPROBANTE,
  condicionIvaLabel,
  esFacturaCompraConVencimiento,
  fromCents,
  resolverPercepcion,
  sumarImportes,
  toCents,
  totalesLineas,
  type ComprobanteRecibido,
  type ComprobanteRecibidoInput,
  type ComprobanteRecibidoLineaTipo,
  type ComprobanteRecibidoPrecarga,
  type ComprobanteRecibidoTipo,
  type CondicionIvaProveedor,
  type FacturaRecibidaClase,
  type FacturaCompraConVencimiento,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";
import { toISODateAppTimeZone } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import { calcularFacturaADesdeBases, calcularFacturaBDesdeImportesConIva, type FacturaDesgloseIvaAlicuota } from "@/lib/comprobantesRecibidos/iva";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import VencimientoFacturaCompraModal from "./VencimientoFacturaCompraModal";

type LineaDraft = {
  key: string;
  tipo: ComprobanteRecibidoLineaTipo;
  /** Concepto: descripción libre. Percepción: código sugerido o texto libre del selector abierto. */
  descripcion: string;
  cantidad: number;
  importe: string;
  ivaAlicuotaId?: number | null;
  original?: { cantidad: number; unitario: number; importe: number; ivaAlicuotaId: number | null };
};

type FormState = {
  tipoDocumento: ComprobanteRecibidoTipo;
  clase: FacturaRecibidaClase | "";
  numero: string;
  fecha: string;
  emisorRazonSocial: string;
  emisorCuit: string;
  emisorCondicionIva: CondicionIvaProveedor | "";
  emisorDomicilio: string;
  receptorRazonSocial: string;
  receptorCuit: string;
  receptorCondicionIva: CondicionIvaProveedor | "";
  /** Sin campo en el formulario: se conservan los valores de documentos cargados antes. */
  codigoAutorizacion: string;
  vencimientoAutorizacion: string;
  fechaVencimiento: string;
  observaciones: string;
  lineas: LineaDraft[];
  ivaContenidoHistorico: number | null;
};

export type ComprobanteRecibidoModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (comprobante: ComprobanteRecibido) => void;
  operacionId: string;
  precarga: ComprobanteRecibidoPrecarga;
  /** Documento existente: edición (o consulta si `readOnly`). Sin documento: alta. */
  comprobante?: ComprobanteRecibido | null;
  initialTipo?: ComprobanteRecibidoTipo;
  /** Alta precargada con un documento ya cargado que no se pudo guardar (reintento). */
  initialInput?: ComprobanteRecibidoInput;
  /** Conceptos originales en el orden del documento, con cantidades y precios unitarios. */
  initialConceptos?: readonly ConceptoFactura[];
  /** Clave de idempotencia a reutilizar en el alta (reintento de un intento anterior). */
  idempotencyKey?: string;
  initialError?: string;
  readOnly?: boolean;
};

function nuevaLinea(tipo: ComprobanteRecibidoLineaTipo = "CONCEPTO"): LineaDraft {
  return { key: generateUuidV4(), tipo, descripcion: "", cantidad: 1, importe: "", ivaAlicuotaId: tipo === "CONCEPTO" ? 5 : null };
}

function conceptosGuardados(comprobante: ComprobanteRecibidoInput): ConceptoFactura[] {
  const conceptos = comprobante.lineas.filter(({ tipo }) => tipo === "CONCEPTO");
  const conceptosConIva = comprobante.clase === "A" ? conceptos.flatMap((linea, index) => (
    linea.ivaAlicuotaId == null ? [] : [{ ...linea, key: String(index), ivaAlicuotaId: linea.ivaAlicuotaId }]
  )) : [];
  const bases = new Map(calcularFacturaBDesdeImportesConIva(conceptosConIva).conceptos.map(({ key, base }) => [key, base]));

  // Una base confirmada puede diferir del cálculo inverso por redondeo o por el IVA informado.
  for (const { ivaAlicuotaId, base, iva } of comprobante.desgloseIva ?? []) {
    const grupo = conceptosConIva.filter((linea) => linea.ivaAlicuotaId === ivaAlicuotaId);
    if (grupo.length === 1 && toCents(base) + toCents(iva) === toCents(grupo[0].importe)) {
      bases.set(grupo[0].key, base);
    }
  }

  return conceptos.map((linea, index) => {
    const key = String(index);
    const detalle = /^([\s\S]*) \(x([2-9]|[1-9]\d+)\)$/.exec(linea.descripcion);
    const cantidad = Number(detalle?.[2] ?? 1);
    const tieneCantidad = detalle && Number.isSafeInteger(cantidad);
    const importe = bases.get(key) ?? linea.importe;
    return {
      key,
      descripcion: tieneCantidad ? detalle[1] : linea.descripcion,
      cantidad: tieneCantidad ? cantidad : 1,
      importe,
      unitario: tieneCantidad ? importe / cantidad : importe,
    };
  });
}

function estadoInicial(
  precarga: ComprobanteRecibidoPrecarga,
  comprobante: ComprobanteRecibidoInput | null | undefined,
  initialTipo: ComprobanteRecibidoTipo,
  initialConceptos?: readonly ConceptoFactura[],
  editando = false,
): FormState {
  if (comprobante) {
    const conceptos = editando && comprobante.tipoDocumento === "FACTURA" ? conceptosGuardados(comprobante) : initialConceptos;
    let indiceConcepto = 0;
    return {
      tipoDocumento: comprobante.tipoDocumento,
      clase: comprobante.clase ?? "",
      numero: comprobante.numero ?? "",
      fecha: comprobante.fecha,
      emisorRazonSocial: comprobante.emisor.razonSocial ?? "",
      emisorCuit: comprobante.emisor.cuit ?? "",
      emisorCondicionIva: comprobante.emisor.condicionIva ?? "",
      emisorDomicilio: comprobante.emisor.domicilio ?? "",
      receptorRazonSocial: comprobante.receptor.razonSocial ?? "",
      receptorCuit: comprobante.receptor.cuit ?? "",
      receptorCondicionIva: comprobante.receptor.condicionIva ?? "",
      codigoAutorizacion: comprobante.codigoAutorizacion ?? "",
      vencimientoAutorizacion: comprobante.vencimientoAutorizacion ?? "",
      fechaVencimiento: comprobante.fechaVencimiento ?? "",
      observaciones: comprobante.observaciones ?? "",
      lineas: comprobante.lineas.map((linea) => {
        const concepto = linea.tipo === "CONCEPTO" ? conceptos?.[indiceConcepto++] : undefined;
        const cantidad = concepto?.cantidad ?? 1;
        const unitario = concepto?.unitario ?? concepto?.importe ?? linea.importe;
        const ivaAlicuotaId = linea.ivaAlicuotaId ?? null;
        return {
          key: linea.id ?? generateUuidV4(),
          tipo: linea.tipo,
          descripcion: linea.tipo === "PERCEPCION" && linea.percepcionCodigo && linea.percepcionCodigo !== "OTRA"
            ? linea.percepcionCodigo
            : concepto?.descripcion.slice(0, 200) ?? linea.descripcion,
          cantidad,
          importe: String(unitario),
          ivaAlicuotaId,
          original: editando && concepto ? { cantidad, unitario, importe: linea.importe, ivaAlicuotaId } : undefined,
        };
      }),
      ivaContenidoHistorico: comprobante.ivaContenido ?? null,
    };
  }
  // Precarga: copia editable de la ficha del proveedor y de los datos fiscales del tenant.
  return {
    tipoDocumento: initialTipo,
    clase: "",
    numero: "",
    fecha: toISODateAppTimeZone(),
    emisorRazonSocial: precarga.emisor.razonSocial ?? "",
    emisorCuit: precarga.emisor.cuit ?? "",
    emisorCondicionIva: precarga.emisor.condicionIva ?? "",
    emisorDomicilio: precarga.emisor.domicilio ?? "",
    receptorRazonSocial: precarga.receptor.razonSocial ?? "",
    receptorCuit: precarga.receptor.cuit ?? "",
    receptorCondicionIva: precarga.receptor.condicionIva ?? "",
    codigoAutorizacion: "",
    vencimientoAutorizacion: "",
    fechaVencimiento: "",
    observaciones: "",
    lineas: [nuevaLinea()],
    ivaContenidoHistorico: null,
  };
}

function importeLinea(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type CalculoFactura = {
  importes: ReadonlyMap<string, number>;
  desgloseIva: FacturaDesgloseIvaAlicuota[] | null;
};

function subtotalConcepto(linea: LineaDraft): number {
  return fromCents(toCents(linea.cantidad * importeLinea(linea.importe)));
}

function calcularFactura(lineas: LineaDraft[], clase: FormState["clase"], comprobante?: ComprobanteRecibido | null): CalculoFactura {
  // Si solo se editaron otros datos, preservá los importes y el IVA declarado, incluido el redondeo original.
  const guardados = lineas.flatMap(({ key, original, cantidad, importe, ivaAlicuotaId }) => (
    original && original.cantidad === cantidad && original.unitario === importeLinea(importe) && original.ivaAlicuotaId === ivaAlicuotaId
      ? [[key, original.importe] as const]
      : []
  ));
  if (comprobante && comprobante.clase === clase && guardados.length === lineas.length
    && comprobante.lineas.filter(({ tipo }) => tipo === "CONCEPTO").length === lineas.length) {
    return { importes: new Map(guardados), desgloseIva: comprobante.desgloseIva ?? null };
  }

  const conceptos = lineas.map((linea) => ({
    key: linea.key,
    importe: subtotalConcepto(linea),
    ivaAlicuotaId: linea.ivaAlicuotaId ?? (comprobante ? null : 5),
  }));
  const importes = new Map(conceptos.map(({ key, importe }) => [key, importe]));
  if (clase === "A") {
    const calculo = calcularFacturaADesdeBases(conceptos.flatMap((concepto) => (
      concepto.ivaAlicuotaId == null || concepto.importe <= 0 ? [] : [{ ...concepto, ivaAlicuotaId: concepto.ivaAlicuotaId }]
    )));
    calculo.conceptos.forEach(({ key, total }) => importes.set(key, total));
    return { importes, desgloseIva: calculo.desgloseIva };
  }
  return { importes, desgloseIva: null };
}

function toInput(form: FormState, proveedorId: string | null, calculo: CalculoFactura | null, isEditing: boolean): unknown {
  const esFactura = form.tipoDocumento === "FACTURA";
  const usaAlicuota = esFactura && (form.clase === "A" || form.clase === "B");
  const lineas = [
    ...form.lineas.filter((linea) => linea.tipo === "CONCEPTO"),
    ...form.lineas.filter((linea) => linea.tipo === "PERCEPCION"),
  ];
  return {
    tipoDocumento: form.tipoDocumento,
    clase: form.tipoDocumento === "FACTURA" ? form.clase || null : null,
    numero: form.numero,
    fecha: form.fecha,
    proveedorId,
    emisor: {
      razonSocial: form.emisorRazonSocial,
      cuit: form.emisorCuit,
      condicionIva: form.emisorCondicionIva || null,
      domicilio: form.emisorDomicilio,
    },
    receptor: {
      razonSocial: form.receptorRazonSocial,
      cuit: form.receptorCuit,
      condicionIva: form.receptorCondicionIva || null,
    },
    codigoAutorizacion: form.codigoAutorizacion,
    vencimientoAutorizacion: form.vencimientoAutorizacion,
    fechaVencimiento: form.tipoDocumento === "FACTURA" ? form.fechaVencimiento : "",
    observaciones: form.observaciones,
    ivaContenido: esFactura && form.clase === "B" ? form.ivaContenidoHistorico : null,
    desgloseIva: calculo?.desgloseIva ?? null,
    lineas: lineas.map((linea) => {
      const importeTexto = linea.importe.trim().replace(",", ".");
      const importe = importeTexto ? Number(importeTexto) : Number.NaN;
      if (linea.tipo === "PERCEPCION") {
        const percepcion = resolverPercepcion(linea.descripcion);
        return {
          tipo: "PERCEPCION",
          descripcion: percepcion?.descripcion ?? "",
          percepcionCodigo: percepcion?.codigo ?? "OTRA",
          importe,
        };
      }
      return {
        tipo: "CONCEPTO",
        descripcion: calculo ? descripcionConceptoFactura(linea.descripcion, linea.cantidad) : linea.descripcion,
        percepcionCodigo: null,
        importe: calculo ? calculo.importes.get(linea.key) ?? 0 : importe,
        ivaAlicuotaId: usaAlicuota ? linea.ivaAlicuotaId ?? (!isEditing && form.clase === "A" ? 5 : null) : null,
      };
    }),
  };
}

export default function ComprobanteRecibidoModal({
  open,
  onClose,
  onSaved,
  operacionId,
  precarga,
  comprobante,
  initialTipo = "FACTURA",
  initialInput,
  initialConceptos,
  idempotencyKey,
  initialError,
  readOnly = false,
}: ComprobanteRecibidoModalProps) {
  const { success } = useToast();
  const isEditing = Boolean(comprobante);
  const editarConceptos = isEditing && !readOnly;
  const [form, setForm] = useState<FormState>(() => estadoInicial(precarga, comprobante ?? initialInput, initialTipo, initialConceptos, editarConceptos));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [facturaConVencimiento, setFacturaConVencimiento] = useState<FacturaCompraConVencimiento | null>(null);
  // La misma clave en todos los reintentos del alta: el documento se registra una sola vez.
  const idempotencyKeyRef = useRef(idempotencyKey ?? generateUuidV4());

  useEffect(() => {
    if (!open) return;
    setForm(estadoInicial(precarga, comprobante ?? initialInput, initialTipo, initialConceptos, editarConceptos));
    setError(initialError ?? null);
    setSubmitting(false);
    setFacturaConVencimiento(null);
    idempotencyKeyRef.current = idempotencyKey ?? generateUuidV4();
    // Se reinicia al abrir o al cambiar el documento o el modo de consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, comprobante?.id, readOnly]);

  const esFactura = form.tipoDocumento === "FACTURA";
  const facturaEditable = esFactura && !readOnly;
  const usaAlicuota = esFactura && (form.clase === "A" || form.clase === "B");
  const conceptos = useMemo(() => form.lineas.filter((linea) => linea.tipo === "CONCEPTO"), [form.lineas]);
  const percepciones = form.lineas
    .filter((linea) => linea.tipo === "PERCEPCION")
    .map(({ key, descripcion, importe }) => ({ key, percepcion: descripcion, importe }));

  const calculoFactura = useMemo(() => {
    if (!facturaEditable) return null;
    try {
      return calcularFactura(conceptos, form.clase, comprobante);
    } catch {
      return null;
    }
  }, [facturaEditable, conceptos, form.clase, comprobante]);
  const desgloseIva = readOnly ? comprobante?.desgloseIva : calculoFactura?.desgloseIva;
  const totalIva = sumarImportes(desgloseIva?.map(({ iva }) => iva) ?? []);
  const totales = totalesLineas(form.lineas.map((linea) => ({
    tipo: linea.tipo,
    importe: facturaEditable && linea.tipo === "CONCEPTO"
      ? calculoFactura?.importes.get(linea.key) ?? 0
      : importeLinea(linea.importe),
  })));
  const calculaIva = facturaEditable && form.clase === "A";
  const admiteAlicuotaSinConfirmar = isEditing && form.clase === "A";
  const sinAlicuota = admiteAlicuotaSinConfirmar && conceptos.some((linea) => linea.ivaAlicuotaId == null);
  const labelSubtotal = sinAlicuota ? "Subtotal" : calculaIva ? "Total neto" : "Total";
  const totalNeto = fromCents(toCents(totales.totalConceptos) - toCents(totalIva));
  const estilosColumnas = facturaEditable
    ? [styles.lineaFactura, usaAlicuota && styles.lineaFacturaConIva]
    : [usaAlicuota && styles.lineaConAlicuota];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const updateLinea = (key: string, patch: Partial<LineaDraft>) => {
    setForm((current) => ({
      ...current,
      lineas: current.lineas.map((linea) => (linea.key === key ? { ...linea, ...patch } : linea)),
    }));
    if (error) setError(null);
  };

  const cambiarAlicuota = (linea: LineaDraft, value: string) => {
    const ivaAlicuotaId = value ? Number(value) : null;
    const subtotal = subtotalConcepto(linea);
    if (!admiteAlicuotaSinConfirmar || linea.cantidad < 1 || !Number.isSafeInteger(toCents(subtotal))
      || (linea.ivaAlicuotaId == null) === (ivaAlicuotaId == null)) {
      updateLinea(linea.key, { ivaAlicuotaId });
      return;
    }
    // En una factura A histórica, el importe de una línea sin alícuota es el final.
    const importe = ivaAlicuotaId == null
      ? calculoFactura?.importes.get(linea.key)
      : calcularFacturaBDesdeImportesConIva([{ key: linea.key, importe: subtotal, ivaAlicuotaId }]).conceptos[0].base;
    updateLinea(linea.key, {
      ivaAlicuotaId,
      importe: importe === undefined || !linea.importe ? linea.importe : String(importe / linea.cantidad),
    });
  };

  const addLinea = (tipo: ComprobanteRecibidoLineaTipo) => {
    const linea = nuevaLinea(tipo);
    setForm((current) => (
      current.lineas.length >= MAX_LINEAS_COMPROBANTE ? current : { ...current, lineas: [...current.lineas, linea] }
    ));
    return linea.key;
  };

  const removeLinea = (key: string) => {
    setForm((current) => current.lineas.length <= 1
      ? current
      : { ...current, lineas: current.lineas.filter((linea) => linea.key !== key) });
    if (error) setError(null);
  };

  const cambiarTipoDocumento = (tipo: ComprobanteRecibidoTipo) => {
    setForm((current) => ({
      ...current,
      tipoDocumento: tipo,
      // Las retenciones solo registran conceptos (descripción e importe).
      lineas: tipo === "RETENCION"
        ? current.lineas.map((linea) => (linea.tipo === "PERCEPCION" ? { ...linea, tipo: "CONCEPTO", descripcion: "" } : linea))
        : current.lineas,
    }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || submitting) return;
    if (facturaEditable && conceptos.some(({ cantidad }) => !Number.isSafeInteger(cantidad) || cantidad < 1)) {
      setError("Ingresá una cantidad entera mayor a 0 para cada concepto.");
      return;
    }
    if (facturaEditable && !calculoFactura) {
      setError("No se pudo calcular el IVA. Revisá los importes y las alícuotas de los conceptos.");
      return;
    }
    const parsed = parseComprobanteRecibidoInput(toInput(form, comprobante?.proveedorId ?? precarga.proveedorId, calculoFactura, isEditing));
    if (parsed.error || !parsed.value) {
      setError(parsed.error ?? "Revisá los datos del documento");
      return;
    }
    const input: ComprobanteRecibidoInput = parsed.value;
    setSubmitting(true);
    setError(null);
    try {
      const saved = comprobante
        ? await comprobantesRecibidosClient.update(comprobante.id, input)
        : await comprobantesRecibidosClient.create(operacionId, input, idempotencyKeyRef.current);
      success(
        isEditing ? "Documento actualizado" : "Documento guardado",
        "Los pagos, saldos y stock de la operación no cambiaron.",
      );
      onSaved?.(saved);
      if (!isEditing && esFacturaCompraConVencimiento(saved)) {
        setFacturaConVencimiento(saved);
      } else {
        onClose();
      }
    } catch (cause) {
      // El fallo nunca se presenta como guardado: el formulario queda abierto para reintentar.
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el documento");
    } finally {
      setSubmitting(false);
    }
  };

  if (open && facturaConVencimiento) {
    return <VencimientoFacturaCompraModal factura={facturaConVencimiento} onClose={onClose} />;
  }

  const title = readOnly
    ? `${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento]} recibida`
    : isEditing
      ? `Editar ${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento].toLowerCase()}`
      : `Nueva ${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento].toLowerCase()} recibida`;

  const condicionOptions = CONDICIONES_IVA_PROVEEDOR.map((condicion) => ({ value: condicion.value, label: condicion.label }));
  const alicuotaOptions = ALICUOTAS_IVA_ARCA.map((rate) => ({ value: String(rate.id), label: rate.label }));
  const errorBanner = error ? (
    <div role="alert" style={styles.errorBanner} data-testid="comprobante-recibido-error">{error}</div>
  ) : null;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={isEditing ? "Guardar cambios" : "Guardar documento"}
      submitting={submitting}
      disabledSubmit={submitting}
      hideFooter={readOnly}
      showCloseButton
      modalStyle={{ width: "min(1040px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}
    >
      <div style={styles.form} data-testid="comprobante-recibido-form">
        {!isEditing && !readOnly ? (
          <div style={styles.segmented} role="group" aria-label="Tipo de documento">
            {(["FACTURA", "RETENCION"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => cambiarTipoDocumento(tipo)}
                style={form.tipoDocumento === tipo ? { ...styles.segment, ...styles.segmentActive } : styles.segment}
                aria-pressed={form.tipoDocumento === tipo}
                data-testid={`comprobante-recibido-tipo-${tipo}`}
              >
                {COMPROBANTE_RECIBIDO_TIPO_LABEL[tipo]}
              </button>
            ))}
          </div>
        ) : null}

        <section style={styles.section} aria-label="Datos del documento">
          <h4 style={styles.sectionTitle}>Documento</h4>
          <div style={styles.row}>
            {esFactura ? (
              <Field label="Clase" required>
                <div style={styles.segmented} role="group" aria-label="Clase de factura">
                  {FACTURA_RECIBIDA_CLASES.map((clase) => (
                    <button
                      key={clase}
                      type="button"
                      disabled={readOnly}
                      onClick={() => update("clase", clase)}
                      style={form.clase === clase ? { ...styles.segment, ...styles.segmentActive } : styles.segment}
                      aria-pressed={form.clase === clase}
                      data-testid={`comprobante-recibido-clase-${clase}`}
                    >
                      {clase}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}
            <Field label={esFactura ? "Número de factura" : "Número o identificación"} required={esFactura} htmlFor="comprobante-recibido-numero">
              <input
                id="comprobante-recibido-numero"
                style={styles.input}
                value={form.numero}
                disabled={readOnly}
                maxLength={50}
                onChange={(event) => update("numero", event.target.value)}
                placeholder={esFactura ? "Ej: 0001-00001234" : "Opcional"}
                data-testid="comprobante-recibido-numero"
              />
            </Field>
            <Field label="Fecha" required>
              <Calendar
                value={form.fecha}
                onChange={(value) => update("fecha", value)}
                disabled={readOnly}
                dataTestId="comprobante-recibido-fecha"
                ariaLabel="Fecha del documento"
                style={{ height: 38, fontSize: 14 }}
              />
            </Field>
            {esFactura ? (
              <Field label="Fecha de vencimiento">
                <Calendar
                  value={form.fechaVencimiento}
                  onChange={(value) => update("fechaVencimiento", value)}
                  disabled={readOnly}
                  clearable
                  min={form.fecha || undefined}
                  placeholder="Sin vencimiento"
                  dataTestId="comprobante-recibido-fecha-vencimiento"
                  ariaLabel="Fecha de vencimiento del documento"
                  style={{ height: 38, fontSize: 14 }}
                />
              </Field>
            ) : null}
          </div>
        </section>

        <section style={styles.section} aria-label="Emisor">
          <h4 style={styles.sectionTitle}>Emisor (proveedor)</h4>
          <p style={styles.hint}>
            Datos precargados de la ficha del proveedor. Podés corregirlos para este documento: la ficha no cambia.
          </p>
          <div style={styles.row}>
            <Field label="Razón social" required grow htmlFor="comprobante-recibido-emisor-razon-social">
              <input
                id="comprobante-recibido-emisor-razon-social"
                style={styles.input}
                value={form.emisorRazonSocial}
                disabled={readOnly}
                maxLength={200}
                onChange={(event) => update("emisorRazonSocial", event.target.value)}
                data-testid="comprobante-recibido-emisor-razon-social"
              />
            </Field>
            <Field label="CUIT emisor" required={esFactura} htmlFor="comprobante-recibido-emisor-cuit">
              <input
                id="comprobante-recibido-emisor-cuit"
                style={styles.input}
                value={form.emisorCuit}
                disabled={readOnly}
                maxLength={20}
                inputMode="numeric"
                onChange={(event) => update("emisorCuit", event.target.value)}
                placeholder="30-71234567-8"
                data-testid="comprobante-recibido-emisor-cuit"
              />
            </Field>
          </div>
          <div style={styles.row}>
            <Field label="Posición de IVA del proveedor" required={esFactura}>
              {readOnly ? (
                <input style={styles.input} disabled value={condicionIvaLabel(form.emisorCondicionIva || null)} />
              ) : (
                <Autocomplete
                  aria-label="Posición de IVA del proveedor"
                  value={form.emisorCondicionIva}
                  onChange={(value) => update("emisorCondicionIva", value as CondicionIvaProveedor | "")}
                  options={condicionOptions}
                  placeholder="Seleccionar posición"
                  style={{ height: 38, fontSize: 14 }}
                  dataTestId="comprobante-recibido-emisor-condicion-iva"
                />
              )}
            </Field>
            <Field label="Domicilio" grow htmlFor="comprobante-recibido-emisor-domicilio">
              <input
                id="comprobante-recibido-emisor-domicilio"
                style={styles.input}
                value={form.emisorDomicilio}
                disabled={readOnly}
                maxLength={300}
                onChange={(event) => update("emisorDomicilio", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section style={styles.section} aria-label="Líneas">
          <h4 style={styles.sectionTitle}>{esFactura ? "Conceptos" : "Detalle de la retención"}</h4>
          {facturaEditable && form.clase ? (
            <p style={styles.hint}>
              {sinAlicuota
                ? "Ingresá el precio unitario sin IVA en los conceptos con alícuota y el precio final en los que estén sin confirmar."
                : calculaIva ? "Ingresá el precio unitario sin IVA." : "Ingresá el precio unitario final."}
            </p>
          ) : null}
          <div style={styles.lineasCard}>
            <div css={[styles.lineasHeader, ...estilosColumnas]} aria-hidden="true">
              <div>DETALLE</div>
              {facturaEditable ? <div>CANTIDAD</div> : null}
              {usaAlicuota ? <div>{form.clase === "B" ? "ALÍCUOTA IVA INCLUIDO" : "ALÍCUOTA IVA"}</div> : null}
              <div style={{ textAlign: "right" }}>{facturaEditable ? "UNITARIO" : "IMPORTE"}</div>
              {facturaEditable ? <div style={{ textAlign: "right" }}>{labelSubtotal.toUpperCase()}</div> : null}
              <div />
            </div>
            <div>
              {conceptos.map((linea, index) => (
                <div
                  key={linea.key}
                  css={[styles.lineaRow, ...estilosColumnas]}
                  data-testid={`comprobante-recibido-linea-${index}`}
                >
                  <input
                    style={styles.input}
                    value={linea.descripcion}
                    disabled={readOnly || submitting}
                    maxLength={200}
                    placeholder={esFactura ? "Descripción del concepto" : "Ej: Retención Ganancias"}
                    aria-label={`Descripción de la línea ${index + 1}`}
                    onChange={(event) => updateLinea(linea.key, { descripcion: event.target.value })}
                    data-testid={`comprobante-recibido-linea-${index}-descripcion`}
                  />
                  {facturaEditable ? (
                    <label data-campo="cantidad">
                      <span css={styles.labelMovil}>Cantidad</span>
                      <NumberInput
                        aria-label={`Cantidad de la línea ${index + 1}`}
                        allowDecimals={false}
                        minValue={0}
                        value={linea.cantidad}
                        disabled={submitting}
                        style={styles.input}
                        onValueChange={(cantidad) => updateLinea(linea.key, { cantidad })}
                      />
                    </label>
                  ) : null}
                  {usaAlicuota ? (
                    <div data-campo="alicuota">
                      {facturaEditable ? <span css={styles.labelMovil}>Alícuota IVA</span> : null}
                      <Dropdown
                        ariaLabel={`Alícuota de la línea ${index + 1}`}
                        placeholder={admiteAlicuotaSinConfirmar ? "Sin confirmar" : "Elegí alícuota"}
                        style={{ height: 38, fontSize: 14, width: "100%", minWidth: 0 }}
                        disabled={readOnly || submitting}
                        value={String(linea.ivaAlicuotaId ?? (calculaIva && !isEditing ? 5 : ""))}
                        options={admiteAlicuotaSinConfirmar ? [{ value: "", label: "Sin confirmar" }, ...alicuotaOptions] : alicuotaOptions}
                        onChange={(value) => cambiarAlicuota(linea, value)}
                      />
                    </div>
                  ) : null}
                  <label data-campo="unitario">
                    {facturaEditable ? <span css={styles.labelMovil}>Unitario</span> : null}
                    <input
                      style={{ ...styles.input, textAlign: "right" }}
                      value={linea.importe}
                      disabled={readOnly || submitting}
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label={`${facturaEditable ? "Precio unitario" : "Importe"} de la línea ${index + 1}`}
                      onChange={(event) => updateLinea(linea.key, { importe: event.target.value.replace(/[^0-9.,]/g, "") })}
                      data-testid={`comprobante-recibido-linea-${index}-importe`}
                    />
                  </label>
                  {facturaEditable ? (
                    <div data-campo="subtotal" style={{ textAlign: "right" }}>
                      <span css={styles.labelMovil}>{labelSubtotal}</span>
                      <strong>{formatArs(subtotalConcepto(linea))}</strong>
                    </div>
                  ) : null}
                  {!readOnly ? (
                    <IconButton
                      type="button"
                      icon={<Trash2 />}
                      size={16}
                      onClick={() => removeLinea(linea.key)}
                      disabled={submitting || form.lineas.length <= 1}
                      ariaLabel={`Quitar línea ${index + 1}`}
                      title="Quitar línea"
                      data-testid={`comprobante-recibido-linea-${index}-quitar`}
                      style={styles.removeButton}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {!readOnly ? (
            <div style={styles.lineActions}>
              <Button
                type="button"
                onClick={() => addLinea("CONCEPTO")}
                disabled={submitting || form.lineas.length >= MAX_LINEAS_COMPROBANTE}
                dataTestId="comprobante-recibido-agregar-concepto"
                text="Agregar concepto"
                icon={<Plus size={16} />}
                outline
                hideTextOnMobile={false}
                style={{ minWidth: 0, fontSize: 14, padding: "8px 12px" }}
              />
            </div>
          ) : null}

          {esFactura ? (
            <OperacionPercepcionesEditor
              contexto="factura"
              percepciones={percepciones}
              montoBase={totales.totalConceptos}
              showTotals={false}
              limite={MAX_LINEAS_COMPROBANTE - conceptos.length}
              disabled={readOnly || submitting}
              readOnly={readOnly}
              addPercepcion={() => addLinea("PERCEPCION")}
              updatePercepcion={(key, { percepcion, importe }) => updateLinea(key, {
                ...(percepcion !== undefined ? { descripcion: percepcion } : {}),
                ...(importe !== undefined ? { importe } : {}),
              })}
              removePercepcion={removeLinea}
            />
          ) : null}

          {desgloseIva ? <FacturaIvaPorAlicuota desglose={desgloseIva} /> : null}

          <div style={styles.totales} data-testid="comprobante-recibido-totales">
            {esFactura ? (
              <>
                <span>Conceptos: <strong>{formatArs(calculaIva ? totalNeto : totales.totalConceptos)}</strong></span>
                {calculaIva && desgloseIva?.length ? <span>IVA: <strong>{formatArs(totalIva)}</strong></span> : null}
                <span>Percepciones: <strong>{formatArs(totales.totalPercepciones)}</strong></span>
              </>
            ) : null}
            <span>Total del documento: <strong>{formatArs(totales.total)}</strong></span>
          </div>
        </section>

        {!esFactura ? (
          <div style={styles.infoBox} role="note">
            <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={styles.infoText}>
              La retención es un registro informativo: no requiere ni modifica pagos, saldo pendiente, estado de pago, cuentas ni stock.
            </span>
          </div>
        ) : null}

        <details style={styles.details}>
          <summary style={styles.summary}>Receptor y observaciones</summary>
          <div style={styles.detailsBody}>
            <p style={styles.hint}>Receptor: tu empresa. Se precarga desde la configuración de facturación.</p>
            <div style={styles.row}>
              <Field label="Razón social del receptor" grow htmlFor="comprobante-recibido-receptor-razon-social">
                <input
                  id="comprobante-recibido-receptor-razon-social"
                  style={styles.input}
                  value={form.receptorRazonSocial}
                  disabled={readOnly}
                  maxLength={200}
                  onChange={(event) => update("receptorRazonSocial", event.target.value)}
                />
              </Field>
              <Field label="CUIT receptor" htmlFor="comprobante-recibido-receptor-cuit">
                <input
                  id="comprobante-recibido-receptor-cuit"
                  style={styles.input}
                  value={form.receptorCuit}
                  disabled={readOnly}
                  maxLength={20}
                  inputMode="numeric"
                  onChange={(event) => update("receptorCuit", event.target.value)}
                />
              </Field>
              <Field label="Posición de IVA del receptor">
                {readOnly ? (
                  <input style={styles.input} disabled value={condicionIvaLabel(form.receptorCondicionIva || null)} />
                ) : (
                  <Autocomplete
                    aria-label="Posición de IVA del receptor"
                    value={form.receptorCondicionIva}
                    onChange={(value) => update("receptorCondicionIva", value as CondicionIvaProveedor | "")}
                    options={condicionOptions}
                    placeholder="Seleccionar posición"
                    style={{ height: 38, fontSize: 14 }}
                  />
                )}
              </Field>
            </div>
            <Field label="Observaciones" grow htmlFor="comprobante-recibido-observaciones">
              <textarea
                id="comprobante-recibido-observaciones"
                style={{ ...styles.input, height: 72, padding: "8px 12px", resize: "vertical" }}
                value={form.observaciones}
                disabled={readOnly}
                maxLength={1000}
                onChange={(event) => update("observaciones", event.target.value)}
              />
            </Field>
          </div>
        </details>
        {errorBanner}
      </div>
    </Modal>
  );
}

function Field({
  label,
  required = false,
  grow = false,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  grow?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...styles.field, ...(grow ? { flex: 2 } : {}) }}>
      {htmlFor ? (
        <label style={styles.label} htmlFor={htmlFor}>
          {label}
          {required ? <span style={styles.required}> *</span> : null}
        </label>
      ) : (
        <span style={styles.label}>
          {label}
          {required ? <span style={styles.required}> *</span> : null}
        </span>
      )}
      {children}
    </div>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: 12, padding: "4px 0 8px" },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: COLOR.TEXT.PRIMARY },
  hint: { margin: 0, fontSize: 12, color: COLOR.TEXT.SECONDARY },
  row: { display: "flex", gap: 12, alignItems: "flex-end" as const, flexWrap: "wrap" as const },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, flex: 1, minWidth: 160 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 0,
  },
  required: { color: REQUIRED_ICON_COLOR, fontWeight: 700, marginLeft: 2 },
  input: {
    height: 38,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  segmented: {
    display: "inline-flex",
    alignItems: "center",
    height: 38,
    boxSizing: "border-box" as const,
    gap: 4,
    padding: 4,
    borderRadius: 10,
    background: COLOR.BACKGROUND.SUBTLE,
    alignSelf: "flex-start" as const,
  },
  segment: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    border: "none",
    borderRadius: 8,
    padding: "0 16px",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  segmentActive: {
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  lineasCard: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    overflow: "hidden" as const,
  },
  lineasHeader: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 140px 36px",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    "@media (max-width: 720px)": { display: "none" },
  }),
  lineaRow: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 140px 36px",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    "&:last-child": { borderBottom: 0 },
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) 36px",
      "& > input:first-of-type": { gridColumn: "1 / -1" },
    },
  }),
  lineaConAlicuota: css({
    gridTemplateColumns: "minmax(0, 1fr) 160px 140px 36px",
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 36px",
    },
  }),
  lineaFactura: css({
    gridTemplateColumns: "minmax(0, 1fr) 80px 110px 120px 36px",
    "& > [data-campo]": { minWidth: 0 },
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 36px",
      "& > [data-campo='subtotal']": { gridColumn: "1 / 3" },
      "& > button": { gridColumn: 3, gridRow: "2 / 4", alignSelf: "end" },
    },
  }),
  lineaFacturaConIva: css({
    gridTemplateColumns: "minmax(0, 1fr) 80px 130px 110px 120px 36px",
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 36px",
      "& > [data-campo='subtotal']": { gridColumn: 2 },
    },
  }),
  labelMovil: css({
    display: "none",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    "@media (max-width: 720px)": { display: "block", marginBottom: 4 },
  }),
  removeButton: {
    width: 36,
    height: 36,
    padding: 0,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  },
  lineActions: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  totales: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 16,
    flexWrap: "wrap" as const,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    paddingTop: 4,
  },
  infoBox: {
    display: "flex",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 8,
    background: COLOR.STATUS.INFO.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.INFO.BORDER}`,
    color: COLOR.STATUS.INFO.TEXT,
    fontSize: 13,
  },
  infoText: { display: "flex", flexDirection: "column" as const, gap: 2 },
  details: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  },
  summary: { cursor: "pointer", fontSize: 14, fontWeight: 700, color: COLOR.TEXT.PRIMARY },
  detailsBody: { display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 10 },
  errorBanner: {
    padding: "10px 14px",
    borderRadius: 8,
    background: COLOR.STATUS.DANGER.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.DANGER.BORDER}`,
    color: COLOR.STATUS.DANGER.TEXT,
    fontSize: 13,
    fontWeight: 500,
  },
} as const;
