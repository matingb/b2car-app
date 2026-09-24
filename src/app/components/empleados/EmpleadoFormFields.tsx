"use client";

import React, { useEffect, useMemo } from "react";
import Calendar from "@/app/components/ui/Calendar";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import NumberInput from "@/app/components/ui/NumberInput";
import type { Taller } from "@/model/types";
import { toISODateLocal } from "@/lib/fechas";

export type EmpleadoFormFieldsValues = {
  tallerId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  cumpleanos: string;
  salario: number | null;
  valorHora: number | null;
  salarioVigenteDesde?: string;
  fechaIngreso: string;
};

type Props = {
  values: EmpleadoFormFieldsValues;
  onChange: (patch: Partial<EmpleadoFormFieldsValues>) => void;
  talleres: Taller[];
  onValidityChange?: (isValid: boolean) => void;
  mode: "create" | "edit";
};

export function validateEmpleadoForm(
  values: EmpleadoFormFieldsValues,
): boolean {
  const hasSalario = values.salario !== null && values.salario > 0;
  const hasVigencia = Boolean(values.salarioVigenteDesde?.trim()) || Boolean(values.fechaIngreso?.trim());
  const hasVigenciaIfSalario = !hasSalario || hasVigencia;
  const valorHoraCents = (values.valorHora ?? 0) * 100;
  const validValorHora = values.valorHora === null || (
    Number.isFinite(values.valorHora) && values.valorHora >= 0 &&
    values.valorHora <= 9_999_999_999.99 &&
    Math.abs(valorHoraCents - Math.round(valorHoraCents)) <= 1e-7
  );

  return Boolean(
    values.tallerId.trim() &&
    values.nombre.trim() &&
    values.apellido.trim() &&
    values.dni.trim() &&
    (values.salario === null || values.salario >= 0) &&
    validValorHora &&
    hasVigenciaIfSalario,
  );
}

export default function EmpleadoFormFields({
  mode,
  values,
  onChange,
  talleres,
  onValidityChange,
}: Props) {
  const isValid = useMemo(() => validateEmpleadoForm(values), [values]);

  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  const tallerOptions = useMemo(
    () => [
      { id: "", nombre: "Seleccionar taller..." } as Pick<
        Taller,
        "id" | "nombre"
      >,
      ...talleres,
    ],
    [talleres],
  );

  return (
    <>
      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            Nombre{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            style={styles.input}
            value={values.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej: Carlos"
            data-testid="empleado-form-nombre"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Apellido{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            style={styles.input}
            value={values.apellido}
            onChange={(e) => onChange({ apellido: e.target.value })}
            placeholder="Ej: Mendoza"
            data-testid="empleado-form-apellido"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            DNI{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            style={styles.input}
            value={values.dni}
            onChange={(e) => onChange({ dni: e.target.value })}
            placeholder="Ej: 32145678"
            data-testid="empleado-form-dni"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Taller{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <select
            style={styles.input}
            value={values.tallerId}
            onChange={(e) => onChange({ tallerId: e.target.value })}
            data-testid="empleado-form-taller"
          >
            {tallerOptions.map((t) => (
              <option key={t.id || "__placeholder"} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            style={styles.input}
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="empleado@taller.com"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Teléfono</label>
          <input
            style={styles.input}
            value={values.telefono}
            onChange={(e) => onChange({ telefono: e.target.value })}
            placeholder="+54 11 1234-5678"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Fecha de nacimiento</label>
          <Calendar
            value={values.cumpleanos}
            onChange={(fecha) => onChange({ cumpleanos: fecha })}
            dataTestId="empleado-form-cumpleanos"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Fecha de ingreso</label>
          <Calendar
            value={values.fechaIngreso}
            onChange={(fecha) => {
              onChange({
                fechaIngreso: fecha,
                ...(fecha && !values.salarioVigenteDesde
                  ? { salarioVigenteDesde: fecha.slice(0, 7) }
                  : {}),
              });
            }}
            dataTestId="empleado-form-fecha-ingreso"
          />
        </div>
      </div>

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Valor hora</label>
          <input
            type="number"
            min="0"
            max="9999999999.99"
            step="0.01"
            style={styles.input}
            value={values.valorHora ?? ""}
            onChange={(e) => onChange({ valorHora: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="Sin configurar"
            data-testid="empleado-form-valor-hora"
          />
        </div>
      </div>

      {mode === "create" && (
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Salario</label>
            <NumberInput
              minValue={0}
              value={values.salario ?? 0}
              onValueChange={(next) => onChange({ salario: next })}
              placeholder="0"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Vigente desde</label>
            <Calendar
              value={
                values.salarioVigenteDesde
                  ? /^\d{4}-\d{2}$/.test(values.salarioVigenteDesde)
                    ? `${values.salarioVigenteDesde}-01`
                    : values.salarioVigenteDesde
                  : toISODateLocal(new Date()).slice(0, 8) + "01"
              }
              onChange={(fecha) =>
                onChange({ salarioVigenteDesde: fecha ? fecha.slice(0, 7) : "" })
              }
              dataTestId="empleado-form-vigente-desde"
            />
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  field: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
    outline: "none",
  },
} as const;
