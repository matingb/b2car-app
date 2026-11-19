"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import { Info, Plus, Trash2 } from "lucide-react";
import Calendar from "@/app/components/ui/Calendar";
import Button from "@/app/components/ui/Button";
import IconInput from "@/app/components/ui/IconInput";
import Modal from "@/app/components/ui/Modal";
import IconButton from "@/app/components/ui/IconButton";
import Dropdown from "@/app/components/ui/Dropdown";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useToast } from "@/app/providers/ToastProvider";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import { parseComprobanteRecibidoInput } from "@/lib/comprobantesRecibidos/input";
import {
  COMPROBANTE_RECIBIDO_TIPO_LABEL,
  CONDICIONES_IVA_PROVEEDOR,
  FACTURA_RECIBIDA_CLASES,
  MAX_LINEAS_COMPROBANTE,
  PERCEPCIONES_SUGERIDAS,
  condicionIvaLabel,
  resolverPercepcion,
  totalesLineas,
  type ComprobanteRecibido,
  type ComprobanteRecibidoInput,
  type ComprobanteRecibidoLineaTipo,
  type ComprobanteRecibidoPrecarga,
  type ComprobanteRecibidoTipo,
  type CondicionIvaProveedor,
  type FacturaRecibidaClase,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";
import { toISODateAppTimeZone } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import { sugerirIvaDesdeBase } from "@/lib/comprobantesRecibidos/iva";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

type LineaDraft = {
  key: string;
  tipo: ComprobanteRecibidoLineaTipo;
  /** Concepto: descripción libre. Percepción: código sugerido o texto libre del selector abierto. */
  descripcion: string;
  importe: string;
  ivaAlicuotaId?: number | null;
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
  desgloseIva: Array<{ ivaAlicuotaId: number; base: string; iva: string; ivaManual?: boolean }> | null;
  ivaContenido: string;
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
  /** Clave de idempotencia a reutilizar en el alta (reintento de un intento anterior). */
  idempotencyKey?: string;
  initialError?: string;
  readOnly?: boolean;
};

function nuevaLinea(tipo: ComprobanteRecibidoLineaTipo = "CONCEPTO"): LineaDraft {
  return { key: generateUuidV4(), tipo, descripcion: "", importe: "", ivaAlicuotaId: tipo === "CONCEPTO" ? 5 : null };
}

function estadoInicial(
  precarga: ComprobanteRecibidoPrecarga,
  comprobante: ComprobanteRecibidoInput | null | undefined,
  initialTipo: ComprobanteRecibidoTipo,
): FormState {
  if (comprobante) {
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
      lineas: comprobante.lineas.map((linea) => ({
        key: linea.id ?? generateUuidV4(),
        tipo: linea.tipo,
        descripcion: linea.tipo === "PERCEPCION" && linea.percepcionCodigo && linea.percepcionCodigo !== "OTRA"
          ? linea.percepcionCodigo
          : linea.descripcion,
        importe: String(linea.importe),
        ivaAlicuotaId: linea.ivaAlicuotaId ?? null,
      })),
      desgloseIva: comprobante.desgloseIva?.map((item) => ({ ...item, base: String(item.base), iva: String(item.iva), ivaManual: true })) ?? null,
      ivaContenido: comprobante.ivaContenido == null ? "" : String(comprobante.ivaContenido),
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
    desgloseIva: null,
    ivaContenido: "",
  };
}

function importeLinea(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toInput(form: FormState, proveedorId: string | null): unknown {
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
    ivaContenido: form.tipoDocumento === "FACTURA" && form.clase === "B" && form.ivaContenido.trim() !== ""
      ? Number(form.ivaContenido.trim().replace(",", "."))
      : null,
    desgloseIva: form.tipoDocumento === "FACTURA" && form.clase === "A" && form.desgloseIva?.length
      ? form.desgloseIva.map(({ ivaAlicuotaId, base, iva }) => ({ ivaAlicuotaId, base: base.trim() === "" ? null : Number(base), iva: iva.trim() === "" ? null : Number(iva) }))
      : null,
    lineas: form.lineas.map((linea) => {
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
      return { tipo: "CONCEPTO", descripcion: linea.descripcion, percepcionCodigo: null, importe, ivaAlicuotaId: form.tipoDocumento === "FACTURA" && form.clase === "A" ? linea.ivaAlicuotaId ?? null : null };
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
  idempotencyKey,
  initialError,
  readOnly = false,
}: ComprobanteRecibidoModalProps) {
  const { success } = useToast();
  const isEditing = Boolean(comprobante);
  const [form, setForm] = useState<FormState>(() => estadoInicial(precarga, comprobante ?? initialInput, initialTipo));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  // La misma clave en todos los reintentos del alta: el documento se registra una sola vez.
  const idempotencyKeyRef = useRef(idempotencyKey ?? generateUuidV4());

  useEffect(() => {
    if (!open) return;
    setForm(estadoInicial(precarga, comprobante ?? initialInput, initialTipo));
    setError(initialError ?? null);
    setSubmitting(false);
    idempotencyKeyRef.current = idempotencyKey ?? generateUuidV4();
    // Solo se reinicia al abrir o al cambiar el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, comprobante?.id]);

  const esFactura = form.tipoDocumento === "FACTURA";

  const totales = useMemo(
    () => totalesLineas(form.lineas.map((linea) => ({ tipo: linea.tipo, importe: importeLinea(linea.importe) }))),
    [form.lineas],
  );

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

  const addLinea = (tipo: ComprobanteRecibidoLineaTipo) => {
    setForm((current) => (
      current.lineas.length >= MAX_LINEAS_COMPROBANTE ? current : { ...current, lineas: [...current.lineas, nuevaLinea(tipo)] }
    ));
  };

  const removeLinea = (key: string) => {
    setForm((current) => ({ ...current, lineas: current.lineas.filter((linea) => linea.key !== key) }));
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
    const parsed = parseComprobanteRecibidoInput(toInput(form, comprobante?.proveedorId ?? precarga.proveedorId));
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
      onClose();
    } catch (cause) {
      // El fallo nunca se presenta como guardado: el formulario queda abierto para reintentar.
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el documento");
    } finally {
      setSubmitting(false);
    }
  };

  const title = readOnly
    ? `${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento]} recibida`
    : isEditing
      ? `Editar ${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento].toLowerCase()}`
      : `Nueva ${COMPROBANTE_RECIBIDO_TIPO_LABEL[form.tipoDocumento].toLowerCase()} recibida`;

  const condicionOptions = CONDICIONES_IVA_PROVEEDOR.map((condicion) => ({ value: condicion.value, label: condicion.label }));
  const percepcionOptions = PERCEPCIONES_SUGERIDAS.map((sugerida) => ({ value: sugerida.codigo, label: sugerida.label }));

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
        {error ? <div role="alert" style={styles.errorBanner} data-testid="comprobante-recibido-error">{error}</div> : null}

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
          <h4 style={styles.sectionTitle}>{esFactura ? "Conceptos y percepciones" : "Detalle de la retención"}</h4>
          <p style={styles.hint}>
            {form.clase === "A"
              ? "En esta carga manual, ingresá el importe del concepto y confirmá el desglose de IVA en la sección siguiente."
              : form.clase === "B"
                ? "En factura B, ingresá los importes finales. El IVA contenido es opcional e informativo; no se discrimina ni se calcula desde las líneas."
                : "Descripciones e importes manuales. En factura C se conserva el importe final sin discriminar IVA."}
          </p>
          {esFactura && form.clase === "A" && !readOnly ? (
            <label style={styles.hint}>Aplicar alícuota a todos los conceptos
              <select aria-label="Aplicar alícuota a todos los conceptos" style={styles.input} value="" onChange={(event) => {
                const ivaAlicuotaId = Number(event.target.value);
                if (ivaAlicuotaId) setForm((current) => ({ ...current, lineas: current.lineas.map((linea) => linea.tipo === "CONCEPTO" ? { ...linea, ivaAlicuotaId } : linea) }));
              }}>
                <option value="">Seleccionar</option>
                {ALICUOTAS_IVA_ARCA.map((rate) => <option key={rate.id} value={rate.id}>{rate.label}</option>)}
              </select>
            </label>
          ) : null}
          <div style={styles.lineasCard}>
              <div css={[styles.lineasHeader, !esFactura && styles.lineasHeaderSinTipo]} aria-hidden="true">
              {esFactura ? <div style={styles.lineaTipo}>TIPO</div> : null}
              <div style={styles.lineaDescripcion}>DETALLE</div>
              <div style={{ ...styles.lineaImporte, textAlign: "right" }}>IMPORTE</div>
              <div style={styles.lineaActionsHeader} />
            </div>
            <div style={styles.lineas}>
              {form.lineas.map((linea, index) => (
                <div
                  key={linea.key}
                  css={[styles.lineaRow, !esFactura && styles.lineaRowSinTipo]}
                  data-testid={`comprobante-recibido-linea-${index}`}
                >
                  {esFactura ? (
                    <div style={styles.lineaTipo}>
                      {readOnly ? (
                        <span style={styles.lineaTipoLabel}>{linea.tipo === "PERCEPCION" ? "Percepción" : "Concepto"}</span>
                      ) : (
                        <Dropdown
                          ariaLabel={`Tipo de la línea ${index + 1}`}
                          value={linea.tipo}
                          onChange={(value) => updateLinea(linea.key, { tipo: value as ComprobanteRecibidoLineaTipo, descripcion: "" })}
                          style={{ height: 38, fontSize: 14 }}
                          options={[
                            { value: "CONCEPTO", label: "Concepto" },
                            { value: "PERCEPCION", label: "Percepción" },
                          ]}
                        />
                      )}
                    </div>
                  ) : null}
                  <div style={styles.lineaDescripcion}>
                    {linea.tipo === "PERCEPCION" ? (
                      <Autocomplete
                        options={percepcionOptions}
                        value={linea.descripcion}
                        onChange={(value) => updateLinea(linea.key, { descripcion: value })}
                        allowCustomValue
                        disabled={readOnly}
                        placeholder="Elegí o escribí una percepción"
                        aria-label={`Percepción de la línea ${index + 1}`}
                        maxLength={200}
                        dataTestId={`comprobante-recibido-linea-${index}-percepcion`}
                        style={{ height: 38, fontSize: 14 }}
                      />
                    ) : (
                      <input
                        style={styles.input}
                        value={linea.descripcion}
                        disabled={readOnly}
                        maxLength={200}
                        placeholder={esFactura ? "Descripción del concepto" : "Ej: Retención Ganancias"}
                        aria-label={`Descripción de la línea ${index + 1}`}
                        onChange={(event) => updateLinea(linea.key, { descripcion: event.target.value })}
                        data-testid={`comprobante-recibido-linea-${index}-descripcion`}
                      />
                    )}
                    {esFactura && form.clase === "A" && linea.tipo === "CONCEPTO" ? (
                      <label style={styles.hint}>
                        Alícuota IVA
                        <select
                          aria-label={`Alícuota de la línea ${index + 1}`}
                          style={styles.input}
                          disabled={readOnly}
                          value={linea.ivaAlicuotaId ?? ""}
                          onChange={(event) => updateLinea(linea.key, { ivaAlicuotaId: event.target.value ? Number(event.target.value) : null })}
                        >
                          <option value="">Sin confirmar</option>
                          {ALICUOTAS_IVA_ARCA.map((rate) => <option key={rate.id} value={rate.id}>{rate.label}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div style={styles.lineaImporte}>
                    <input
                      style={{ ...styles.input, textAlign: "right" }}
                      value={linea.importe}
                      disabled={readOnly}
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label={`Importe de la línea ${index + 1}`}
                      onChange={(event) => updateLinea(linea.key, { importe: event.target.value.replace(/[^0-9.,]/g, "") })}
                      data-testid={`comprobante-recibido-linea-${index}-importe`}
                    />
                  </div>
                  {!readOnly ? (
                    <IconButton
                      type="button"
                      icon={<Trash2 />}
                      size={16}
                      onClick={() => removeLinea(linea.key)}
                      disabled={form.lineas.length <= 1}
                      ariaLabel={`Quitar línea ${index + 1}`}
                      title="Quitar línea"
                      data-testid={`comprobante-recibido-linea-${index}-quitar`}
                      style={styles.removeButton}
                    />
                  ) : <div style={styles.lineaActionsHeader} />}
                </div>
              ))}
            </div>
          </div>
          {!readOnly ? (
            <div style={styles.lineActions}>
              <Button
                type="button"
                onClick={() => addLinea("CONCEPTO")}
                dataTestId="comprobante-recibido-agregar-concepto"
                text="Agregar concepto"
                icon={<Plus size={16} />}
                outline
                hideTextOnMobile={false}
                style={{ minWidth: 0, fontSize: 14, padding: "8px 12px" }}
              />
              {esFactura ? (
                <Button
                  type="button"
                  onClick={() => addLinea("PERCEPCION")}
                  dataTestId="comprobante-recibido-agregar-percepcion"
                  text="Agregar percepción"
                  icon={<Plus size={16} />}
                  outline
                  hideTextOnMobile={false}
                  style={{ minWidth: 0, fontSize: 14, padding: "8px 12px" }}
                />
              ) : null}
            </div>
          ) : null}

          {esFactura && form.clase === "B" ? (
            <div style={{ ...styles.row, marginTop: 12 }}>
              <Field label="IVA contenido informado (opcional)" grow htmlFor="comprobante-recibido-iva-contenido">
                <IconInput
                  id="comprobante-recibido-iva-contenido"
                  aria-label="IVA contenido informado"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={readOnly}
                  value={form.ivaContenido}
                  wrapperStyle={{ height: 38, padding: "0 10px" }}
                  style={{ fontSize: 14 }}
                  onChange={(event) => update("ivaContenido", event.target.value)}
                  data-testid="comprobante-recibido-iva-contenido"
                />
              </Field>
            </div>
          ) : null}

          {esFactura && form.clase === "A" ? (
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Desglose de IVA confirmado</h4>
              <p style={styles.hint}>Ingresá la base neta. Sugerimos el IVA según la alícuota; podés corregirlo por redondeos. Estos importes no se agregan al total.</p>
              {(form.desgloseIva ?? []).map((item, index) => (
                <div key={item.ivaAlicuotaId} style={styles.row}>
                  <span>{ALICUOTAS_IVA_ARCA.find((rate) => rate.id === item.ivaAlicuotaId)?.label}</span>
                  <Field label="Base neta">
                    <IconInput
                      aria-label={`Base neta ${item.ivaAlicuotaId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={readOnly}
                      value={item.base}
                      wrapperStyle={{ height: 38, padding: "0 10px" }}
                      style={{ fontSize: 14 }}
                      onChange={(event) => update("desgloseIva", (form.desgloseIva ?? []).map((row, i) => i === index
                        ? { ...row, base: event.target.value, iva: row.ivaManual ? row.iva : sugerirIvaDesdeBase(event.target.value, row.ivaAlicuotaId) }
                        : row))}
                    />
                  </Field>
                  <Field label="IVA facturado">
                    <IconInput
                      aria-label={`IVA facturado ${item.ivaAlicuotaId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={readOnly}
                      value={item.iva}
                      wrapperStyle={{ height: 38, padding: "0 10px" }}
                      style={{ fontSize: 14 }}
                      onChange={(event) => update("desgloseIva", (form.desgloseIva ?? []).map((row, i) => i === index
                        ? { ...row, iva: event.target.value, ivaManual: true }
                        : row))}
                    />
                  </Field>
                  {!readOnly ? <button type="button" onClick={() => update("desgloseIva", (form.desgloseIva ?? []).filter((_, i) => i !== index))}>Quitar</button> : null}
                </div>
              ))}
              {!readOnly ? ALICUOTAS_IVA_ARCA.filter((rate) => !(form.desgloseIva ?? []).some((item) => item.ivaAlicuotaId === rate.id)).map((rate) => (
                <button key={rate.id} type="button" onClick={() => update("desgloseIva", [...(form.desgloseIva ?? []), { ivaAlicuotaId: rate.id, base: "", iva: "", ivaManual: false }])}>Agregar {rate.label}</button>
              )) : null}
            </div>
          ) : null}

          <div style={styles.totales} data-testid="comprobante-recibido-totales">
            {esFactura ? (
              <>
                <span>Conceptos: <strong>{formatArs(totales.totalConceptos)}</strong></span>
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
    gridTemplateColumns: "150px minmax(0, 1fr) 140px 36px",
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
  lineasHeaderSinTipo: css({
    gridTemplateColumns: "minmax(0, 1fr) 140px 36px",
  }),
  lineas: { display: "flex", flexDirection: "column" as const },
  lineaRow: css({
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr) 140px 36px",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    "@media (max-width: 720px)": {
      display: "flex",
      flexWrap: "wrap",
    },
  }),
  lineaRowSinTipo: css({
    gridTemplateColumns: "minmax(0, 1fr) 140px 36px",
  }),
  lineaTipo: { width: 150, flex: "0 0 auto" },
  lineaTipoLabel: { fontSize: 13, fontWeight: 600, color: COLOR.TEXT.SECONDARY },
  lineaDescripcion: { flex: "1 1 240px", minWidth: 180 },
  lineaImporte: { width: 140, flex: "0 0 auto" },
  lineaActionsHeader: { width: 36, flex: "0 0 auto" },
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
