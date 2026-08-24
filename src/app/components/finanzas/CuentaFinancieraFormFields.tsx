"use client";

import React, { useMemo, useEffect } from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import Dropdown from "@/app/components/ui/Dropdown";
import NumberInput from "@/app/components/ui/NumberInput";
import {
  CUENTA_TIPOS,
  getCuentaTipoLabel,
  type TipoCuentaFinanciera,
} from "@/model/finanzas";

export type CuentaFinancieraDraft = {
  nombre: string;
  tipo: TipoCuentaFinanciera;
  saldoInicial: number;
  activo: boolean;
};

export const EMPTY_CUENTA_FINANCIERA_DRAFT: CuentaFinancieraDraft = {
  nombre: "",
  tipo: "EFECTIVO",
  saldoInicial: 0,
  activo: true,
};

export function validateCuentaFinancieraForm(
  draft: Partial<CuentaFinancieraDraft> | null | undefined
): boolean {
  if (!draft) return false;
  return Boolean(draft.nombre?.trim() && draft.tipo);
}

export type CuentaFinancieraFormFieldsProps = {
  values: CuentaFinancieraDraft;
  onChange: (patch: Partial<CuentaFinancieraDraft>) => void;
  showSaldoInicial?: boolean;
  showActivo?: boolean;
  onValidityChange?: (isValid: boolean) => void;
  compact?: boolean;
  dataTestIdPrefix?: string;
};

export default function CuentaFinancieraFormFields({
  values,
  onChange,
  showSaldoInicial = true,
  showActivo = true,
  onValidityChange,
  compact = false,
  dataTestIdPrefix = "cuenta-financiera",
}: CuentaFinancieraFormFieldsProps) {
  const isValid = useMemo(() => validateCuentaFinancieraForm(values), [values]);

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  const tipoOptions = useMemo(
    () =>
      CUENTA_TIPOS.map((tipo) => ({
        value: tipo,
        label: getCuentaTipoLabel(tipo),
      })),
    []
  );

  return (
    <div css={compact ? styles.containerCompact : styles.container}>
      <div css={styles.row}>
        <div css={styles.fieldFlex3}>
          <label css={styles.label}>
            Nombre de la cuenta{" "}
            <span aria-hidden="true" css={styles.required}>
              *
            </span>
          </label>
          <input
            value={values.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej. Caja principal"
            css={styles.input}
            data-testid={`${dataTestIdPrefix}-nombre`}
          />
        </div>

        <div css={styles.fieldFlex2}>
          <label css={styles.label}>
            Tipo{" "}
            <span aria-hidden="true" css={styles.required}>
              *
            </span>
          </label>
          <Dropdown
            options={tipoOptions}
            value={values.tipo}
            onChange={(tipo) => onChange({ tipo: tipo as TipoCuentaFinanciera })}
            style={styles.dropdown}
            dataTestId={`${dataTestIdPrefix}-tipo`}
          />
        </div>
      </div>

      {(showSaldoInicial || showActivo) && (
        <div css={styles.row}>
          {showSaldoInicial ? (
            <div css={styles.fieldFlex1}>
              <label css={styles.label}>Saldo inicial</label>
              <NumberInput
                value={values.saldoInicial}
                onValueChange={(saldoInicial) => onChange({ saldoInicial })}
                placeholder="0"
                style={styles.input}
                data-testid={`${dataTestIdPrefix}-saldo-inicial`}
              />
              <span css={styles.hint}>
                Punto de partida para el saldo actual.
              </span>
            </div>
          ) : null}

          {showActivo ? (
            <div css={styles.fieldFlex1}>
              <label css={styles.label}>Estado</label>
              <label css={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={values.activo}
                  onChange={(e) => onChange({ activo: e.target.checked })}
                  data-testid={`${dataTestIdPrefix}-activa`}
                />
                <span>
                  <strong css={styles.checkTitle}>Cuenta activa</strong>
                  <span css={styles.checkHelp}>
                    Habilitada para nuevos movimientos.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  }),
  containerCompact: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
  }),
  row: css({
    display: "flex",
    gap: 12,
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      gap: 10,
    },
  }),
  fieldFlex1: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  }),
  fieldFlex2: css({
    flex: 2,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  }),
  fieldFlex3: css({
    flex: 3,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  }),
  label: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    display: "block",
  }),
  required: css({
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  }),
  dropdown: {
    width: "100%",
    minHeight: 40,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  input: {
    width: "100%",
    minHeight: 40,
    boxSizing: "border-box" as const,
    padding: "0 12px",
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 8,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
  },
  hint: css({
    color: COLOR.TEXT.TERTIARY,
    fontSize: 11,
    lineHeight: 1.3,
  }),
  checkRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    minHeight: 40,
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    cursor: "pointer",
  }),
  checkTitle: css({
    display: "block",
    fontSize: 13,
  }),
  checkHelp: css({
    display: "block",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    lineHeight: 1.2,
  }),
} as const;
