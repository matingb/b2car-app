"use client";

import { useEffect, useId, useMemo, type Dispatch, type SetStateAction } from "react";
import { Building2, Info, UserRound } from "lucide-react";
import Dropdown from "@/app/components/ui/Dropdown";
import IconInput from "@/app/components/ui/IconInput";
import { normalizeArcaCuit, useArcaInscriptionLookup } from "@/app/hooks/useArcaInscriptionLookup";
import { getArcaPadronLookupQueryKey, useArcaPadronLookup } from "@/app/hooks/useArcaPadronLookup";
import { documentTypesForInvoiceCondition } from "@/app/components/arreglos/facturaReceptorRules";
import { COLOR } from "@/theme/theme";
import {
  CONDICIONES_IVA_RECEPTOR,
  RECEPTOR_DOMICILIO_MAX,
  RECEPTOR_NOMBRE_MAX,
  TIPOS_DOCUMENTO_FISCAL,
  type CondicionIvaReceptorId,
  type DocumentoFiscalTipo,
  type FacturaClienteAsociado,
  type FacturaOrigenTipo,
} from "@/lib/facturacion/types";
import {
  applyCondicionAutofill,
  applyPadronAutofill,
  editReceptorCampo,
  editReceptorCondicion,
  otroReceptorState,
  receptorIdentityKey,
  selectReceptorCuil,
  setReceptorDocumento,
  setReceptorTipoDocumento,
  type ReceptorState,
} from "./facturaReceptorDraft";
import { FACTURA_CAMPO_INPUT_ID } from "./facturaFormValidation";

type Props = {
  origenTipo: FacturaOrigenTipo;
  value: ReceptorState;
  onChange: Dispatch<SetStateAction<ReceptorState>>;
  /** Precarga del cliente del origen; se restaura al volver a facturarle a él. */
  precarga: ReceptorState;
  clienteAsociado: FacturaClienteAsociado | null;
  advertenciaPrecarga?: string;
  /** Sólo se consulta ARCA mientras se edita; una revisión no cambia por detrás. */
  lookupsEnabled: boolean;
  disabled?: boolean;
  invalidCampos: ReadonlySet<string>;
  describedBy: (campo: string) => string | undefined;
  /** Los datos fiscales del cliente todavía se consultan en ARCA. */
  cargandoCliente?: boolean;
  /** No se pudieron obtener los datos fiscales del cliente. */
  errorCliente?: string | null;
  onRetryCliente?: () => void;
};

type Estado = { texto: string; tono: "info" | "ok" | "aviso"; reintentar?: () => void };

const IVA_OPTIONS = CONDICIONES_IVA_RECEPTOR.map((condicion) => ({ value: String(condicion.id), label: condicion.label }));
const ALL_DOCUMENT_TYPES: DocumentoFiscalTipo[] = [80, 86, 96, 99];
const MANUAL = "Completá los datos manualmente.";
const CARGANDO = "Cargando…";

export default function FacturaReceptorFields({
  origenTipo,
  value,
  onChange,
  precarga,
  clienteAsociado,
  advertenciaPrecarga,
  lookupsEnabled,
  disabled = false,
  invalidCampos,
  describedBy,
  cargandoCliente = false,
  errorCliente = null,
  onRetryCliente,
}: Props) {
  const radioName = useId();
  const statusId = useId();
  const { draft } = value;
  // Mientras llegan los datos del cliente, sólo esta sección queda en espera.
  const pendiente = draft.modo === "CLIENTE" && (cargandoCliente || Boolean(errorCliente));
  const anonymous = !pendiente && draft.tipoDocumento === "99";
  const deLaVenta = origenTipo === "VENTA";
  const clienteLabel = deLaVenta ? "de la venta" : "del arreglo";
  const digits = normalizeArcaCuit(draft.numeroDocumento);
  const identidad = receptorIdentityKey(draft.tipoDocumento, draft.numeroDocumento);
  const padronType = draft.tipoDocumento === "80" ? 80 : draft.tipoDocumento === "86" ? 86 : draft.tipoDocumento === "96" ? 96 : null;
  const consultarArca = lookupsEnabled && !anonymous && !pendiente;
  const padron = useArcaPadronLookup({ enabled: consultarArca, documentType: padronType, documentNumber: digits });
  const padronKey = padronType === null ? "" : getArcaPadronLookupQueryKey(padronType, digits);
  const persona = padron.status === "FOUND" && padron.queryKey === padronKey ? padron.person : null;
  const candidatos = padron.status === "MULTIPLE" && padron.queryKey === padronKey ? padron.candidates : null;
  // La Constancia sólo acepta CUIT/CUIL: un DNI se resuelve primero a su CUIL en el padrón.
  const cuitCondicion = draft.tipoDocumento === "96"
    ? persona ? normalizeArcaCuit(persona.cuit) : ""
    : padronType ? digits : "";
  const inscripcion = useArcaInscriptionLookup({ enabled: consultarArca, cuit: cuitCondicion });
  const verificada = inscripcion.status === "FOUND" && inscripcion.condition.cuit === cuitCondicion
    ? inscripcion.condition
    : null;

  useEffect(() => {
    if (!persona || !identidad) return;
    onChange((current) => applyPadronAutofill(current, identidad, {
      nombre: persona.razonSocial ?? persona.nombreCompleto,
      domicilio: persona.direccion,
    }));
  }, [identidad, onChange, persona]);

  useEffect(() => {
    if (!verificada || !identidad) return;
    onChange((current) => applyCondicionAutofill(current, identidad, verificada));
  }, [identidad, onChange, verificada]);

  const condicion = draft.condicionIvaReceptorId
    ? Number(draft.condicionIvaReceptorId) as CondicionIvaReceptorId
    : null;
  const documentOptions = useMemo(
    () => (condicion ? documentTypesForInvoiceCondition(condicion) : ALL_DOCUMENT_TYPES).map((tipo) => ({
      value: String(tipo),
      label: TIPOS_DOCUMENTO_FISCAL.find((option) => option.id === tipo)?.label ?? "CUIT",
    })),
    [condicion],
  );

  const enPrecarga = draft.modo === "CLIENTE" && identidad !== null && identidad === precarga.identidad;
  // Al facturarle al cliente del origen se usan siempre sus datos; sólo se elige la
  // condición IVA cuando ARCA no pudo confirmarla al precargar.
  const datosDelCliente = draft.modo === "CLIENTE";
  const condicionEditable = !datosDelCliente || !precarga.draft.condicionIvaReceptorId;
  const estados: Estado[] = [];
  if (pendiente) {
    estados.push(errorCliente
      ? { tono: "aviso", texto: `${errorCliente} Podés reintentar o elegir «Otro receptor / CUIT».`, reintentar: onRetryCliente }
      : { tono: "info", texto: `Buscando los datos fiscales del cliente ${clienteLabel} en ARCA…` });
  } else if (datosDelCliente) {
    estados.push({ tono: "info", texto: `Se usan los datos del cliente ${clienteLabel}. Para facturar con otros datos, elegí «Otro receptor / CUIT».` });
  }
  // Sin datos del cliente todavía no hay consultas ni avisos de ARCA que mostrar.
  if (!pendiente && anonymous) {
    estados.push({ tono: "info", texto: "Consumidor final sin identificar: el comprobante no informa nombre, documento ni domicilio." });
  } else if (!pendiente) {
    if (padron.status === "LOADING") estados.push({ tono: "info", texto: "Consultando el padrón de ARCA…" });
    if (persona && value.autocompletado.padron === identidad) {
      estados.push(enPrecarga
        ? { tono: "ok", texto: "Datos verificados con el padrón de ARCA." }
        : { tono: "ok", texto: "Nombre y domicilio obtenidos del padrón de ARCA. Podés corregirlos sólo para este comprobante." });
      if (!persona.direccion) {
        estados.push({ tono: "aviso", texto: `ARCA no informa domicilio para este documento.${datosDelCliente ? "" : " Podés completarlo."}` });
      }
    }
    if ((padron.status === "NOT_FOUND" || padron.status === "ERROR") && identidad) {
      estados.push({ tono: "aviso", texto: `${padron.message} ${MANUAL}` });
    }
    if (inscripcion.status === "LOADING") estados.push({ tono: "info", texto: "Verificando la condición IVA en ARCA…" });
    if (verificada) {
      estados.push(draft.condicionIvaReceptorId === String(verificada.condicionIvaReceptorId)
        ? { tono: "ok", texto: `Condición IVA verificada en ARCA: ${verificada.condicionIvaLabel} (CUIT ${verificada.cuit}).` }
        : { tono: "aviso", texto: `ARCA informa ${verificada.condicionIvaLabel}; se usará la condición seleccionada.` });
    }
    if (inscripcion.status === "UNDETERMINED" || inscripcion.status === "NOT_FOUND" || inscripcion.status === "ERROR") {
      estados.push({ tono: "aviso", texto: `${inscripcion.message} Seleccioná la condición manualmente.`, reintentar: inscripcion.retry });
    }
    if (enPrecarga && advertenciaPrecarga && !candidatos && !verificada && inscripcion.status !== "LOADING") {
      estados.push({ tono: "aviso", texto: advertenciaPrecarga });
    }
  }

  const fieldProps = (campo: string) => ({
    "aria-invalid": invalidCampos.has(campo) || undefined,
    "aria-describedby": describedBy(campo),
    invalid: invalidCampos.has(campo),
  });

  const setModo = (modo: "CLIENTE" | "OTRO") => {
    if (modo === draft.modo) return;
    onChange(modo === "CLIENTE" ? precarga : otroReceptorState());
  };

  // La opción del cliente ya identifica a quién se le factura: nombre y documento de su ficha.
  const clienteDetalle = clienteAsociado
    ? `${clienteAsociado.nombre} · ${clienteAsociado.documento ? `Doc. ${clienteAsociado.documento}` : "Sin documento en la ficha"}`
    : "Sin cliente asociado";

  return (
    <>
      <section style={styles.section}>
        <div id={`${radioName}-modo`} style={styles.sectionTitle}>¿A quién se factura?</div>
        <div role="radiogroup" aria-labelledby={`${radioName}-modo`} style={styles.modeGrid}>
          {([
            ["CLIENTE", clienteAsociado ? `Al cliente ${clienteLabel}` : "Consumidor final", clienteDetalle, UserRound],
            ["OTRO", "Otro receptor / CUIT", "Persona o empresa distinta del cliente", Building2],
          ] as const).map(([modo, label, detail, Icon]) => {
            const checked = draft.modo === modo;
            return (
              <label key={modo} style={{ ...styles.modeOption, ...(checked ? styles.modeOptionChecked : {}) }}>
                <input
                  type="radio"
                  name={radioName}
                  value={modo}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setModo(modo)}
                  style={styles.radio}
                  data-testid={`factura-receptor-modo-${modo.toLowerCase()}`}
                />
                <Icon size={18} aria-hidden="true" style={{ color: checked ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.TERTIARY, flexShrink: 0 }} />
                <span style={styles.modeText}>
                  <strong>{label}</strong>
                  <span style={styles.muted} data-testid={modo === "CLIENTE" ? "factura-cliente-asociado" : undefined}>{detail}</span>
                </span>
              </label>
            );
          })}
        </div>
        {draft.modo === "OTRO" ? (
          <div style={styles.otroNotice} role="note" data-testid="factura-otro-receptor-aviso">
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>La factura se emitirá a este receptor. El cliente {clienteLabel} no cambiará.</span>
          </div>
        ) : null}
      </section>

      <section
        style={styles.section}
        aria-describedby={estados.length ? statusId : undefined}
        aria-busy={pendiente && cargandoCliente}
        data-testid="factura-receptor-datos"
      >
        <div style={styles.sectionTitle}>Datos del receptor fiscal</div>
        <div style={styles.documentRow}>
          <div style={styles.field}>
            <label htmlFor={FACTURA_CAMPO_INPUT_ID["receptor.condicionIva"]} style={styles.label}>Condición frente al IVA</label>
            <div style={invalidCampos.has("receptor.condicionIva") ? styles.invalidControl : undefined}>
              <Dropdown
                id={FACTURA_CAMPO_INPUT_ID["receptor.condicionIva"]}
                ariaLabel="Condición frente al IVA"
                placeholder={pendiente ? CARGANDO : "Seleccioná la condición"}
                options={IVA_OPTIONS}
                value={pendiente ? "" : draft.condicionIvaReceptorId}
                onChange={(id) => onChange((current) => editReceptorCondicion(current, id))}
                disabled={disabled || pendiente || anonymous || !condicionEditable}
                style={styles.dropdown}
                dataTestId="factura-condicion-iva"
              />
            </div>
          </div>
          <div style={styles.field}>
            <label htmlFor={FACTURA_CAMPO_INPUT_ID["receptor.tipoDocumento"]} style={styles.label}>Tipo de documento</label>
            <div style={invalidCampos.has("receptor.tipoDocumento") ? styles.invalidControl : undefined}>
              <Dropdown
                id={FACTURA_CAMPO_INPUT_ID["receptor.tipoDocumento"]}
                ariaLabel="Tipo de documento"
                placeholder={pendiente ? CARGANDO : undefined}
                options={documentOptions}
                value={pendiente ? "" : draft.tipoDocumento}
                onChange={(tipo) => onChange((current) => setReceptorTipoDocumento(current, tipo, precarga))}
                disabled={disabled || datosDelCliente || documentOptions.length <= 1}
                style={styles.dropdown}
                dataTestId="factura-tipo-documento"
              />
            </div>
          </div>
          <div style={styles.field}>
            <label htmlFor={FACTURA_CAMPO_INPUT_ID["receptor.numeroDocumento"]} style={styles.label}>Número de documento</label>
            <IconInput
              id={FACTURA_CAMPO_INPUT_ID["receptor.numeroDocumento"]}
              icon={null}
              inputMode="numeric"
              autoComplete="off"
              value={anonymous || pendiente ? "" : draft.numeroDocumento}
              disabled={disabled || datosDelCliente || anonymous}
              placeholder={pendiente ? CARGANDO : anonymous ? "No se informa" : draft.tipoDocumento === "96" ? "Ej: 12345678" : "Ej: 20123456786"}
              wrapperStyle={styles.inputWrapper}
              data-testid="factura-numero-documento"
              onChange={(event) => onChange((current) => setReceptorDocumento(current, current.draft.tipoDocumento, event.target.value))}
              {...fieldProps("receptor.numeroDocumento")}
            />
          </div>
        </div>
        {candidatos ? (
          <div style={styles.field}>
            <label htmlFor="factura-receptor-cuil" style={styles.label}>
              El DNI tiene más de un CUIL asociado en ARCA. Elegí el del receptor
            </label>
            <Dropdown
              id="factura-receptor-cuil"
              ariaLabel="CUIL del receptor"
              placeholder="Seleccioná el CUIL"
              options={candidatos.map((cuil) => ({ value: cuil, label: cuil }))}
              value=""
              onChange={(cuil) => onChange((current) => selectReceptorCuil(current, cuil))}
              disabled={disabled}
              style={styles.dropdown}
              dataTestId="factura-receptor-cuil"
            />
          </div>
        ) : null}
        <div style={styles.identityRow}>
          <div style={styles.field}>
            <label htmlFor={FACTURA_CAMPO_INPUT_ID["receptor.nombre"]} style={styles.label}>Nombre o razón social</label>
            <IconInput
              id={FACTURA_CAMPO_INPUT_ID["receptor.nombre"]}
              icon={null}
              autoComplete="off"
              maxLength={RECEPTOR_NOMBRE_MAX}
              value={pendiente ? "" : draft.nombre}
              placeholder={pendiente ? CARGANDO : undefined}
              disabled={disabled || datosDelCliente || anonymous}
              wrapperStyle={styles.inputWrapper}
              data-testid="factura-receptor-nombre"
              onChange={(event) => onChange((current) => editReceptorCampo(current, "nombre", event.target.value))}
              {...fieldProps("receptor.nombre")}
            />
          </div>
          <div style={styles.field}>
            <label htmlFor={FACTURA_CAMPO_INPUT_ID["receptor.domicilio"]} style={styles.label}>
              Domicilio <span style={styles.optional}>(opcional)</span>
            </label>
            <IconInput
              id={FACTURA_CAMPO_INPUT_ID["receptor.domicilio"]}
              icon={null}
              autoComplete="off"
              maxLength={RECEPTOR_DOMICILIO_MAX}
              value={anonymous || pendiente ? "" : draft.domicilio}
              disabled={disabled || datosDelCliente || anonymous}
              placeholder={pendiente ? CARGANDO : anonymous ? "No se informa" : "Sin domicilio informado"}
              wrapperStyle={styles.inputWrapper}
              data-testid="factura-receptor-domicilio"
              onChange={(event) => onChange((current) => editReceptorCampo(current, "domicilio", event.target.value))}
              {...fieldProps("receptor.domicilio")}
            />
          </div>
        </div>
        {estados.length ? (
          <div id={statusId} role="status" aria-live="polite" style={styles.statusList} data-testid="factura-receptor-estado">
            {estados.map((estado) => (
              <span key={estado.texto} style={{ ...styles.status, ...styles[estado.tono] }}>
                {estado.texto}
                {estado.reintentar ? (
                  <button type="button" style={styles.linkButton} onClick={estado.reintentar} disabled={disabled}>Reintentar</button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}

const styles = {
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionTitle: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingBottom: 10,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
  },
  muted: { color: COLOR.TEXT.SECONDARY, fontSize: 12, lineHeight: 1.35 },
  modeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  modeOption: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.PRIMARY,
    cursor: "pointer",
    minWidth: 0,
  },
  modeOptionChecked: { border: `1px solid ${COLOR.ACCENT.PRIMARY}`, background: COLOR.BACKGROUND.INFO_TINT },
  radio: { accentColor: COLOR.ACCENT.PRIMARY, margin: 0, flexShrink: 0 },
  modeText: { display: "flex", flexDirection: "column" as const, gap: 2, minWidth: 0, color: COLOR.TEXT.PRIMARY, fontSize: 13 },
  otroNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.ACCENT.PRIMARY}`,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    lineHeight: 1.4,
  },
  // Tipo, número y condición IVA comparten fila; en pantallas angostas pasan a una columna.
  documentRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  identityRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0 },
  label: { color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  optional: { color: COLOR.TEXT.TERTIARY, fontWeight: 400 },
  dropdown: { width: "100%", height: 42 },
  inputWrapper: { width: "100%" },
  invalidControl: { borderRadius: 8, boxShadow: `0 0 0 1px ${COLOR.ICON.DANGER}` },
  linkButton: {
    alignSelf: "flex-start",
    border: 0,
    padding: 0,
    marginLeft: 6,
    background: "transparent",
    color: COLOR.ACCENT.PRIMARY,
    cursor: "pointer",
    font: "inherit",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "underline",
  },
  statusList: { display: "flex", flexDirection: "column" as const, gap: 4 },
  status: { fontSize: 12, lineHeight: 1.4 },
  info: { color: COLOR.TEXT.TERTIARY },
  ok: { color: COLOR.SEMANTIC.SUCCESS },
  aviso: { color: COLOR.TEXT.SECONDARY },
} as const;
