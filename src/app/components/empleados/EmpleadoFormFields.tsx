"use client";

import React, { useEffect, useMemo } from "react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import NumberInput from "@/app/components/ui/NumberInput";
import type { Taller } from "@/model/types";

export type EmpleadoFormFieldsValues = {
  tallerId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  cumpleanos: string;
  salario: number | null;
  salarioVigenteDesde?: string;
  fechaIngreso: string;
};

type Props = {
  values: EmpleadoFormFieldsValues;
  onChange: (patch: Partial<EmpleadoFormFieldsValues>) => void;
  talleres: Taller[];
  onValidityChange?: (isValid: boolean) => void;
  showSalarioVigenteDesde?: boolean;
};

export function validateEmpleadoForm(values: EmpleadoFormFieldsValues): boolean {
  return Boolean(
    values.tallerId.trim() &&
      values.nombre.trim() &&
      values.apellido.trim() &&
      values.dni.trim() &&
      (values.salario === null || values.salario >= 0)
  );
}

export default function EmpleadoFormFields({
  values,
  onChange,
  talleres,
  onValidityChange,
  showSalarioVigenteDesde = false,
}: Props) {
  const isValid = useMemo(() => validateEmpleadoForm(values), [values]);

  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  const tallerOptions = useMemo(
    () => [{ id: "", nombre: "Seleccionar taller..." } as Pick<Taller, "id" | "nombre">, ...talleres],
    [talleres]
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
          <input
            type="date"
            style={styles.input}
            value={values.cumpleanos}
            onChange={(e) => onChange({ cumpleanos: e.target.value })}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Fecha de ingreso</label>
          <input
            type="date"
            style={styles.input}
            value={values.fechaIngreso}
            onChange={(e) => onChange({ fechaIngreso: e.target.value })}
          />
        </div>
      </div>

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
          {showSalarioVigenteDesde && (
            <>
              <label style={styles.label}>Vigente desde</label>
              <input
                type="month"
                style={styles.input}
                value={values.salarioVigenteDesde ?? ""}
                onChange={(e) => onChange({ salarioVigenteDesde: e.target.value })}
              />
            </>
          )}
        </div>
      </div>
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
