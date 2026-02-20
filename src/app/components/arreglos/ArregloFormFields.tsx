"use client";

import React, { useEffect, useMemo } from "react";
import Autocomplete, {
  type AutocompleteOption,
} from "@/app/components/ui/Autocomplete";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { isValidDate } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import ServicioLineasEditableSection, {
  type ServicioLinea,
} from "@/app/components/arreglos/lineas/ServicioLineasEditableSection";
import RepuestoLineasEditableSection, {
  type RepuestoLinea,
} from "@/app/components/arreglos/lineas/RepuestoLineasEditableSection";
import { useServiciosDraft } from "@/app/components/arreglos/hooks/useServiciosDraft";
import { useRepuestosDraft } from "@/app/components/arreglos/hooks/useRepuestosDraft";

export type ArregloForm = {
  tipo: string;
  fecha: string;
  kilometraje_leido: number | string;
  precio_final: number | string;
  observaciones?: string;
  descripcion?: string;
  esta_pago?: boolean;
  extra_data?: string;
};

export type ArregloFormFieldsValues = {
  tipo: string;
  fecha: string;
  km: string;
  observaciones: string;
  estaPago: boolean;
  extraData: string;
  selectedVehiculoId: string;
};

export type ArregloFormFieldsInternal = {
  serviciosDraft: ServicioLinea[];
  repuestosDraft: RepuestoLinea[];
  subtotalServicios: number;
  subtotalRepuestos: number;
  totalCalculado: number;
  totalCalculadoLabel: string;
};

type Props = {
  vehiculoId?: number | string;
  vehiculoOptions: AutocompleteOption[];
  isEdit: boolean;
  submitting: boolean;
  tallerId: string | null;
  values: ArregloFormFieldsValues;
  onValuesChange: (patch: Partial<ArregloFormFieldsValues>) => void;
  onValidityChange?: (isValid: boolean) => void;
  onChange?: (next: ArregloFormFieldsInternal) => void;
};

const opcionesDefault: AutocompleteOption[] = [
  { value: "Mecanica", label: "Mecanica" },
  { value: "Chapa y pintura", label: "Chapa y pintura" },
  { value: "Electricidad", label: "Electricidad" },
  { value: "Mantenimiento", label: "Mantenimiento" },
  { value: "Revision", label: "Revision" },
];

export function validateArregloForm(
  values: ArregloFormFieldsValues,
  vehiculoId?: number | string,
): boolean {
  const hasVehiculo = Boolean(
    vehiculoId || values.selectedVehiculoId.trim().length > 0,
  );
  return hasVehiculo && isValidDate(values.fecha);
}

export default function ArregloFormFields({
  vehiculoId,
  vehiculoOptions,
  isEdit,
  submitting,
  tallerId,
  values,
  onValuesChange,
  onValidityChange,
  onChange,
}: Props) {
  const isValid = useMemo(
    () => validateArregloForm(values, vehiculoId),
    [values, vehiculoId],
  );

  const {
    items: serviciosDraft,
    onAdd: onServiciosAdd,
    onUpdate: onServiciosUpdate,
    onDelete: onServiciosDelete,
    reset: resetServicios,
  } = useServiciosDraft();

  const {
    items: repuestosDraft,
    onUpsert: onRepuestosUpsert,
    onDelete: onRepuestosDelete,
    reset: resetRepuestos,
  } = useRepuestosDraft();

  const subtotalServicios = useMemo(
    () =>
      serviciosDraft.reduce(
        (acc, s) =>
          acc + (Number(s.cantidad) || 0) * (Number(s.valor) || 0),
        0,
      ),
    [serviciosDraft],
  );
  const subtotalRepuestos = useMemo(
    () =>
      repuestosDraft.reduce(
        (acc, r) =>
          acc +
          (Number(r.cantidad) || 0) * (Number(r.monto_unitario) || 0),
        0,
      ),
    [repuestosDraft],
  );
  const totalCalculado = subtotalServicios + subtotalRepuestos;
  const totalCalculadoLabel = useMemo(
    () => formatArs(totalCalculado, { maxDecimals: 0, minDecimals: 0 }),
    [totalCalculado],
  );

  const internalSnapshot = useMemo<ArregloFormFieldsInternal>(
    () => ({
      serviciosDraft,
      repuestosDraft,
      subtotalServicios,
      subtotalRepuestos,
      totalCalculado,
      totalCalculadoLabel,
    }),
    [
      serviciosDraft,
      repuestosDraft,
      subtotalServicios,
      subtotalRepuestos,
      totalCalculado,
      totalCalculadoLabel,
    ],
  );

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  useEffect(() => {
    resetServicios();
    resetRepuestos();
  }, [isEdit, resetServicios, resetRepuestos]);

  useEffect(() => {
    onChange?.(internalSnapshot);
  }, [onChange, internalSnapshot]);

  return (
    <>
      <div css={styles.row}>
        {!vehiculoId && (
          <div style={styles.field}>
            <label style={styles.label}>
              Vehiculo{" "}
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            </label>
            <Autocomplete
              options={vehiculoOptions}
              value={values.selectedVehiculoId}
              onChange={(next) => onValuesChange({ selectedVehiculoId: next })}
              placeholder="Buscar vehiculo..."
            />
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Tipo</label>
          <Autocomplete
            options={opcionesDefault}
            value={values.tipo}
            onChange={(next) => onValuesChange({ tipo: next })}
            placeholder="Mecanica, Chapa y pintura..."
            allowCustomValue
          />
        </div>
      </div>

      <div css={styles.kmRow}>
        <div css={styles.kmFechaField}>
          <label style={styles.label}>Kilometraje</label>
          <input
            style={styles.input}
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.km}
            onChange={(e) =>
              onValuesChange({ km: e.target.value.replace(/\D/g, "") })
            }
            placeholder="123456"
          />
        </div>
        <div css={styles.kmFechaField}>
          <label style={styles.label}>
            Fecha{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            type="date"
            style={styles.input}
            value={values.fecha}
            onChange={(e) => onValuesChange({ fecha: e.target.value })}
          />
        </div>
        <div css={styles.pagoField}>
          <label style={styles.label}>¿Esta pago?</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 44,
            }}
          >
            <input
              type="checkbox"
              checked={values.estaPago}
              onChange={(e) => onValuesChange({ estaPago: e.target.checked })}
            />
            <span>Pagado</span>
          </div>
        </div>
      </div>

      {!isEdit ? (
        <div style={{ marginTop: 6 }}>
          <ServicioLineasEditableSection
            items={serviciosDraft}
            onAdd={onServiciosAdd}
            onUpdate={onServiciosUpdate}
            onDelete={onServiciosDelete}
            disabled={submitting}
          />

          <div style={styles.divider} />

          <RepuestoLineasEditableSection
            tallerId={tallerId}
            items={repuestosDraft}
            onUpsert={onRepuestosUpsert}
            onDelete={onRepuestosDelete}
            disabled={submitting}
          />

          <div style={stylesModal.totalRow}>
            <span style={stylesModal.totalLabel}>Total calculado</span>
            <span style={stylesModal.totalValue}>{totalCalculadoLabel}</span>
          </div>
        </div>
      ) : null}

      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Observaciones</label>
          <textarea
            style={styles.input}
            value={values.observaciones}
            onChange={(e) => onValuesChange({ observaciones: e.target.value })}
            placeholder="Observaciones"
            rows={3}
          />
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
  kmRow: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      flexWrap: "wrap",
      gap: 8,
    },
  }),
  kmFechaField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 calc(50% - 4px)",
      minWidth: 140,
    },
  }),
  pagoField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 100%",
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
    boxSizing: "border-box" as const,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  divider: {
    height: 1,
    background: COLOR.BORDER.SUBTLE,
    margin: "18px 0",
  },
} as const;

const stylesModal = {
  totalRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 8,
  },
  totalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
  },
  totalValue: {
    fontWeight: 700,
    fontSize: 18,
    color: COLOR.TEXT.PRIMARY,
  },
} as const;
