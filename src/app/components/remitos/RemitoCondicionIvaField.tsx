"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import Dropdown from "@/app/components/ui/Dropdown";
import { normalizeArcaCuit, useArcaInscriptionLookup } from "@/app/hooks/useArcaInscriptionLookup";
import { getArcaPadronLookupQueryKey, useArcaPadronLookup } from "@/app/hooks/useArcaPadronLookup";
import { CONDICIONES_IVA_RECEPTOR } from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";
import type { DestinatarioForm } from "./RemitoDestinatarioFields";
import { remitoFormStyles } from "./remitoFormStyles";

const OPCIONES = CONDICIONES_IVA_RECEPTOR.map((condicion) => ({ value: String(condicion.id), label: condicion.label }));
const ELEGIR_A_MANO = "Seleccioná la condición manualmente.";

type Estado = { texto: string; tono: "info" | "ok" | "aviso"; reintentar?: boolean };

type Props = {
  value: DestinatarioForm;
  onChange: Dispatch<SetStateAction<DestinatarioForm>>;
  disabled?: boolean;
};

/**
 * Condición frente al IVA del destinatario (RG 1415, Anexo V). Se verifica en la Constancia de
 * Inscripción de ARCA con el documento cargado; si ARCA no la determina, se elige manualmente.
 */
export default function RemitoCondicionIvaField({ value, onChange, disabled = false }: Props) {
  const documento = value.numeroDocumento.replace(/\D/g, "");
  const esDni = value.tipoDocumento === "96";
  // La constancia solo acepta CUIT/CUIL: un DNI se resuelve primero a su CUIL en el padrón.
  const padron = useArcaPadronLookup({ enabled: esDni, documentType: esDni ? 96 : null, documentNumber: documento });
  const cuilDelDni = padron.status === "FOUND" && padron.queryKey === getArcaPadronLookupQueryKey(96, documento)
    ? normalizeArcaCuit(padron.person.cuit)
    : "";
  const cuit = esDni ? cuilDelDni : value.tipoDocumento ? normalizeArcaCuit(documento) : "";
  const inscripcion = useArcaInscriptionLookup({ cuit });
  const verificada = inscripcion.status === "FOUND" && inscripcion.condition.cuit === cuit ? inscripcion.condition : null;
  // CUIT cuya condición se completó desde ARCA: si cambia el documento, esa condición deja de valer.
  const [cuitVerificado, setCuitVerificado] = useState<string | null>(null);

  useEffect(() => {
    if (!verificada) return;
    onChange((previous) => ({ ...previous, condicionIvaReceptorId: String(verificada.condicionIvaReceptorId) }));
    setCuitVerificado(verificada.cuit);
  }, [verificada, onChange]);

  useEffect(() => {
    if (!cuitVerificado || cuitVerificado === cuit) return;
    setCuitVerificado(null);
    onChange((previous) => ({ ...previous, condicionIvaReceptorId: "" }));
  }, [cuitVerificado, cuit, onChange]);

  function estadoConsulta(): Estado | null {
    if (!value.tipoDocumento) {
      return { texto: "Ingresá el documento del destinatario para verificarla en ARCA, o seleccionala manualmente.", tono: "info" };
    }
    if (padron.status === "LOADING" || inscripcion.status === "LOADING") {
      return { texto: "Verificando la condición IVA en ARCA…", tono: "info" };
    }
    if (verificada) {
      return { texto: `Verificada en ARCA: ${verificada.condicionIvaLabel} (CUIT ${verificada.cuit}).`, tono: "ok" };
    }
    if (esDni && padron.status === "MULTIPLE") {
      return { texto: `El DNI tiene más de un CUIL asociado en ARCA. ${ELEGIR_A_MANO}`, tono: "aviso" };
    }
    if (esDni && (padron.status === "NOT_FOUND" || padron.status === "ERROR")) {
      return { texto: `${padron.message} ${ELEGIR_A_MANO}`, tono: "aviso" };
    }
    if (inscripcion.status === "UNDETERMINED") {
      return { texto: inscripcion.message, tono: "aviso", reintentar: true };
    }
    if (inscripcion.status === "NOT_FOUND" || inscripcion.status === "ERROR") {
      return { texto: `${inscripcion.message} ${ELEGIR_A_MANO}`, tono: "aviso", reintentar: true };
    }
    return null;
  }
  const estado = estadoConsulta();

  return (
    <div style={remitoFormStyles.field}>
      <label htmlFor="remito-condicion-iva" style={remitoFormStyles.label}>
        Condición frente al IVA <span style={remitoFormStyles.required}>*</span>
      </label>
      <Dropdown
        id="remito-condicion-iva"
        ariaLabel="Condición frente al IVA"
        placeholder="Seleccioná la condición"
        value={value.condicionIvaReceptorId}
        options={OPCIONES}
        onChange={(condicionIvaReceptorId) => {
          setCuitVerificado(null);
          onChange((previous) => ({ ...previous, condicionIvaReceptorId }));
        }}
        disabled={disabled}
        style={styles.dropdown}
        dataTestId="remito-condicion-iva"
      />
      {estado ? (
        <p role="status" style={{ ...remitoFormStyles.hint, ...styles[estado.tono] }} data-testid="remito-condicion-iva-estado">
          {estado.texto}
          {estado.reintentar ? (
            <button type="button" onClick={inscripcion.retry} disabled={disabled} style={styles.reintentar}>Reintentar</button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

const styles = {
  dropdown: { width: "100%", height: 42, fontSize: 14 },
  info: {},
  ok: { color: COLOR.SEMANTIC.SUCCESS },
  aviso: { color: COLOR.TEXT.SECONDARY },
  reintentar: {
    marginLeft: 6,
    padding: 0,
    border: "none",
    background: "none",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
} as const;
