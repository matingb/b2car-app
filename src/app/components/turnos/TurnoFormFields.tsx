"use client";

import React, { useEffect, useMemo } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import ClienteFormFields from "@/app/components/clientes/ClienteFormFields";
import type { ClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import VehiculoFormFields, { type VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import { TipoCliente, type Cliente, type Vehiculo } from "@/model/types";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";

export const CREATE_CLIENTE_VALUE = "__create_cliente__";
export const CREATE_VEHICULO_VALUE = "__create_vehiculo__";

const DURACIONES_MIN = [30, 45, 60, 90, 120, 150, 180] as const;
const TIPOS_TURNO = [
  "Mecánica",
  "Eléctrica",
  "Carrocería",
  "Pintura",
  "Neumáticos",
  "Service",
] as const;

export type TurnoFormFieldsState = {
  clienteId: string;
  vehiculoId: string;
  fecha: string;
  hora: string;
  duracion: number | null;
  tipo: string;
  descripcion: string;
  observaciones: string;

  clienteDraft: ClienteFormFieldsValue;
  clienteInlineIsValid: boolean;
  vehiculoDraft: VehiculoFormFieldsValue;
  vehiculoInlineIsValid: boolean;
};

export type TurnoFormFieldsContext = {
  clientes: Cliente[];
  vehiculos: Vehiculo[];
};

export type TurnoFormFieldsModel = {
  state: TurnoFormFieldsState;
  context: TurnoFormFieldsContext;
};

export type TurnoFormFieldsPatch = Partial<
  Omit<TurnoFormFieldsState, "clienteDraft" | "vehiculoDraft">
> & {
  clienteDraft?: Partial<ClienteFormFieldsValue>;
  vehiculoDraft?: Partial<VehiculoFormFieldsValue>;
};

type Props = {
  model: TurnoFormFieldsModel;
  onChange: (patch: TurnoFormFieldsPatch) => void;
  onValidityChange?: (isValid: boolean) => void;
};

export function getTurnoInlineFlags(state: Pick<TurnoFormFieldsState, "clienteId" | "vehiculoId">) {
  const isCreatingCliente = state.clienteId === CREATE_CLIENTE_VALUE;
  const isCreatingVehiculo =
    state.vehiculoId === CREATE_VEHICULO_VALUE || isCreatingCliente;
  return { isCreatingCliente, isCreatingVehiculo } as const;
}

export function validateTurnoForm(input: {
  state: TurnoFormFieldsState;
  isCreatingCliente: boolean;
  isCreatingVehiculo: boolean;
}): boolean {
  const { state } = input;
  const okCliente = input.isCreatingCliente
    ? state.clienteInlineIsValid
    : state.clienteId.trim().length > 0;
  const okVehiculo = input.isCreatingVehiculo
    ? state.vehiculoInlineIsValid
    : state.vehiculoId.trim().length > 0;
  const okFecha = /^\d{4}-\d{2}-\d{2}$/.test(state.fecha);
  const okHora = /^\d{2}:\d{2}$/.test(state.hora);
  return okCliente && okVehiculo && okFecha && okHora;
}

export default function TurnoFormFields(props: Props) {
  const { model, onChange, onValidityChange } = props;
  const { state, context } = model;
  const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(state);

  const selectedCliente = useMemo(() => {
    if (!state.clienteId || isCreatingCliente) return undefined;
    return context.clientes.find((c) => String(c.id) === state.clienteId);
  }, [context.clientes, state.clienteId, isCreatingCliente]);

  const vehiculosFiltrados = useMemo(() => {
    if (!selectedCliente) return [];

    const selectedClienteId = String(selectedCliente.id);
    return context.vehiculos.filter((v) => {
      return v.cliente_id != null && String(v.cliente_id) === selectedClienteId;
    });
  }, [context.vehiculos, selectedCliente]);

  const vehiculoDisabled = !selectedCliente && !isCreatingCliente;
  const vehiculoPlaceholder =
    !selectedCliente && !isCreatingCliente
      ? "Seleccione o cree un cliente primero"
      : "Buscar o crear vehículo...";

  const clienteOptions: AutocompleteOption[] = useMemo(
    () => [
      {
        value: CREATE_CLIENTE_VALUE,
        label: "+ Crear cliente",
        secondaryLabel: "Cargar datos del cliente nuevo",
      },
      ...context.clientes.map((c) => ({
        value: String(c.id),
        label: c.nombre,
        secondaryLabel: c.email || undefined,
      })),
    ],
    [context.clientes]
  );

  const vehiculoOptions: AutocompleteOption[] = useMemo(() => {
    const base: AutocompleteOption[] = vehiculosFiltrados.map((v) => {
      const label = formatPatenteConMarcaYModelo(v);
      const secondaryParts = [
        v.nombre_cliente,
        v.nro_interno ? `Int: ${v.nro_interno}` : "",
      ].filter(Boolean);
      return {
        value: String(v.id),
        label: label.length > 3 ? label : v.patente,
        secondaryLabel: secondaryParts.join(" · ") || undefined,
      };
    });

    return [
      {
        value: CREATE_VEHICULO_VALUE,
        label: "+ Crear vehículo",
        secondaryLabel: "Cargar datos del vehículo nuevo",
      },
      ...base,
    ];
  }, [vehiculosFiltrados]);

  const isValid = useMemo(
    () =>
      validateTurnoForm({
        state,
        isCreatingCliente,
        isCreatingVehiculo,
      }),
    [
      state,
      isCreatingCliente,
      isCreatingVehiculo,
    ]
  );

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  return (
    <div style={styles.container}>
      <div>
        <label style={styles.label}>
          Cliente{" "}
          <span aria-hidden="true" style={styles.required}>
            *
          </span>
        </label>
        <Autocomplete
          options={clienteOptions}
          value={state.clienteId}
          onChange={(v) => {
            onChange({ clienteId: v, vehiculoId: "" });
          }}
          placeholder="Buscar cliente..."
        />
        {isCreatingCliente && (
          <div style={styles.inlineForm}>
            <ClienteFormFields
              value={state.clienteDraft}
              onChange={(patch) => onChange({ clienteDraft: patch })}
              onValidityChange={({ isValid }) => {
                if (isValid !== state.clienteInlineIsValid) {
                  onChange({ clienteInlineIsValid: isValid });
                }
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label style={styles.label}>
          Vehículo{" "}
          <span aria-hidden="true" style={styles.required}>
            *
          </span>
        </label>
        {!isCreatingCliente && (
          <Autocomplete
            options={vehiculoOptions}
            value={state.vehiculoId}
            onChange={(v) => onChange({ vehiculoId: v })}
            placeholder={vehiculoPlaceholder}
            disabled={vehiculoDisabled}
          />
        )}

        {(isCreatingVehiculo || isCreatingCliente) && (
          <div style={styles.inlineForm}>
            <VehiculoFormFields
              value={state.vehiculoDraft}
              onChange={(patch) => onChange({ vehiculoDraft: patch })}
              showClienteInput={false}
              tipoCliente={
                selectedCliente?.tipo_cliente ??
                (isCreatingCliente
                  ? state.clienteDraft.tipo_cliente
                  : TipoCliente.PARTICULAR)
              }
              onValidityChange={(isValid) => {
                if (isValid !== state.vehiculoInlineIsValid) {
                  onChange({ vehiculoInlineIsValid: isValid });
                }
              }}
            />
          </div>
        )}
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            Fecha{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            type="date"
            style={styles.input}
            value={state.fecha}
            onChange={(e) => onChange({ fecha: e.target.value })}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Hora{" "}
            <span aria-hidden="true" style={styles.required}>
              *
            </span>
          </label>
          <input
            type="time"
            step={300}
            style={styles.input}
            value={state.hora}
            onChange={(e) => onChange({ hora: e.target.value })}
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Duración</label>
          <Autocomplete
            options={DURACIONES_MIN.map((m) => ({
              value: String(m),
              label: `${m} min`,
            }))}
            value={state.duracion !== null ? String(state.duracion) : ""}
            onChange={(v) => {
              if (!v) {
                onChange({ duracion: null });
                return;
              }
              const parsed = Number(v);
              onChange({ duracion: Number.isFinite(parsed) ? parsed : null });
            }}
            placeholder="Seleccionar duración..."
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Tipo</label>
          <Autocomplete
            options={TIPOS_TURNO.map((t) => ({ value: t, label: t }))}
            value={state.tipo}
            onChange={(v) => onChange({ tipo: v })}
            placeholder="Ej: Mecánica"
            allowCustomValue
          />
        </div>
      </div>

      <div>
        <label style={styles.label}>Descripción del trabajo</label>
        <textarea
          style={styles.textarea}
          value={state.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Qué hay que hacer..."
          rows={3}
        />
      </div>

      <div>
        <label style={styles.label}>Observaciones</label>
        <textarea
          style={styles.textarea}
          value={state.observaciones}
          onChange={(e) => onChange({ observaciones: e.target.value })}
          placeholder="Notas internas, detalles, etc."
          rows={3}
        />
      </div>
    </div>
  );
}

const styles = {
  container: { display: "grid", gap: 12 },
  row: {
    display: "flex",
    gap: 16,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  inlineForm: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
  },
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
    color: COLOR.TEXT.PRIMARY,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    resize: "vertical" as const,
    fontFamily: "inherit",
    fontSize: 14,
  },
} as const;

