"use client";

import React from "react";
import { css } from "@emotion/react";
import { AlertCircle } from "lucide-react";
import Calendar from "@/app/components/ui/Calendar";
import Autocomplete from "@/app/components/ui/Autocomplete";
import {
  CONDICIONES_IVA_PROVEEDOR,
  FACTURA_RECIBIDA_CLASES,
  type CondicionIvaProveedor,
} from "@/lib/comprobantesRecibidos/types";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { useOperacionForm } from "./OperacionFormContext";

const CONDICION_OPTIONS = CONDICIONES_IVA_PROVEEDOR.map((condicion) => ({ value: condicion.value, label: condicion.label }));

/**
 * Datos de la factura recibida, cargados junto con la compra o el gasto. El emisor se precarga
 * con la ficha del proveedor seleccionado como copia editable (la ficha no cambia).
 */
export default function OperacionFacturaFields() {
  const { factura, fecha, isSubmitting } = useOperacionForm();
  const { draft, update, error } = factura;
  const disabled = isSubmitting;

  return (
    <section css={styles.section} aria-label="Datos de la factura" data-testid="operacion-factura">
      <div style={styles.title}>Datos de la factura</div>

      {error ? (
        <div style={styles.errorNotice} role="alert" data-testid="operacion-factura-error">
          <AlertCircle size={16} color={COLOR.STATUS.DANGER.TEXT} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      ) : null}

      <div css={styles.row}>
        <div style={styles.colFixed}>
          <span style={styles.label}>
            Clase <Required />
          </span>
          <div css={styles.segmentedGroup} role="group" aria-label="Clase de factura">
            {FACTURA_RECIBIDA_CLASES.map((clase) => {
              const isSelected = draft.clase === clase;
              return (
                <button
                  key={clase}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => update({ clase })}
                  css={[styles.segmentedBtn, isSelected && styles.segmentedBtnActive]}
                  data-testid={`operacion-factura-clase-${clase}`}
                >
                  {clase}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.col}>
          <label style={styles.label} htmlFor="operacion-factura-numero">
            Número de factura <Required />
          </label>
          <input
            id="operacion-factura-numero"
            style={styles.input}
            value={draft.numero}
            disabled={disabled}
            maxLength={50}
            placeholder="Ej: 0001-00001234"
            onChange={(event) => update({ numero: event.target.value })}
            data-testid="operacion-factura-numero"
          />
        </div>

        <div style={styles.col}>
          <label style={styles.label}>
            Fecha de la factura <Required />
          </label>
          <Calendar
            value={draft.fecha || fecha}
            onChange={(value) => update({ fecha: value })}
            disabled={disabled}
            dataTestId="operacion-factura-fecha"
            ariaLabel="Fecha de la factura"
            style={{ height: 38 }}
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={{ ...styles.col, flex: "2 1 0" }}>
          <label style={styles.label} htmlFor="operacion-factura-emisor-razon-social">
            Razón social del emisor <Required />
          </label>
          <input
            id="operacion-factura-emisor-razon-social"
            style={styles.input}
            value={draft.emisorRazonSocial}
            disabled={disabled}
            maxLength={200}
            onChange={(event) => update({ emisorRazonSocial: event.target.value })}
            data-testid="operacion-factura-emisor-razon-social"
          />
        </div>

        <div style={styles.col}>
          <label style={styles.label} htmlFor="operacion-factura-emisor-cuit">
            CUIT emisor <Required />
          </label>
          <input
            id="operacion-factura-emisor-cuit"
            style={styles.input}
            value={draft.emisorCuit}
            disabled={disabled}
            maxLength={20}
            inputMode="numeric"
            placeholder="30-71234567-8"
            onChange={(event) => update({ emisorCuit: event.target.value })}
            data-testid="operacion-factura-emisor-cuit"
          />
        </div>

        <div style={styles.col}>
          <span style={styles.label}>
            Posición de IVA <Required />
          </span>
          <Autocomplete
            aria-label="Posición de IVA del emisor"
            value={draft.emisorCondicionIva}
            onChange={(value) => update({ emisorCondicionIva: value as CondicionIvaProveedor | "" })}
            options={CONDICION_OPTIONS}
            placeholder="Seleccionar posición"
            disabled={disabled}
            dataTestId="operacion-factura-emisor-condicion-iva"
            style={{ height: 38, fontSize: 14 }}
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={{ ...styles.col, flex: "2 1 0" }}>
          <label style={styles.label} htmlFor="operacion-factura-emisor-domicilio">
            Domicilio del emisor
          </label>
          <input
            id="operacion-factura-emisor-domicilio"
            style={styles.input}
            value={draft.emisorDomicilio}
            disabled={disabled}
            maxLength={300}
            onChange={(event) => update({ emisorDomicilio: event.target.value })}
            data-testid="operacion-factura-emisor-domicilio"
          />
        </div>

        <div style={styles.col}>
          <label style={styles.label}>Fecha de vencimiento</label>
          <Calendar
            value={draft.fechaVencimiento}
            onChange={(value) => update({ fechaVencimiento: value })}
            disabled={disabled}
            clearable
            min={draft.fecha || fecha}
            placeholder="Sin vencimiento"
            dataTestId="operacion-factura-fecha-vencimiento"
            ariaLabel="Fecha de vencimiento de la factura"
            style={{ height: 38 }}
          />
        </div>
      </div>
    </section>
  );
}

function Required() {
  return <span aria-hidden="true" style={styles.required}>*</span>;
}

const styles = {
  section: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  }),
  title: {
    fontWeight: 700,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  } as const,
  row: css({
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
    "@media (max-width: 680px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  col: {
    flex: "1 1 0",
    minWidth: 160,
  } as const,
  colFixed: {
    flex: "0 0 auto",
  } as const,
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  } as const,
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  } as const,
  input: {
    width: "100%",
    height: 38,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  } as const,
  segmentedGroup: css({
    display: "inline-flex",
    alignItems: "center",
    height: 38,
    boxSizing: "border-box",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    padding: 4,
    borderRadius: 10,
    gap: 4,
  }),
  segmentedBtn: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minWidth: 40,
    padding: "0 14px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease-in-out",
    "&:hover:not(:disabled)": {
      color: COLOR.TEXT.PRIMARY,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
  segmentedBtnActive: css({
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    "&:hover:not(:disabled)": {
      color: COLOR.TEXT.CONTRAST,
    },
  }),
  errorNotice: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: COLOR.STATUS.DANGER.BG_SUBTLE,
    borderRadius: 8,
    fontSize: 13,
    color: COLOR.STATUS.DANGER.TEXT,
  } as const,
} as const;
