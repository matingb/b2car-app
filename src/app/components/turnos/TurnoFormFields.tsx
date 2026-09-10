"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { type Cliente, type Vehiculo } from "@/model/types";
import type { ClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import type { VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import { turnoFormStyles as styles } from "@/app/components/turnos/TurnoFormFieldsStyles";
import { useTurnoHorarios } from "@/app/components/turnos/hooks/useTurnoHorarios";
import TurnoClienteVehiculoFields from "@/app/components/turnos/fields/TurnoClienteVehiculoFields";
import TurnoDateTimePicker from "@/app/components/turnos/fields/TurnoDateTimePicker";

export const CREATE_CLIENTE_VALUE = "__create_cliente__";
export const CREATE_VEHICULO_VALUE = "__create_vehiculo__";

const TIPOS_TURNO = [
  "Mecánica",
  "Eléctrica",
  "Carrocería",
  "Pintura",
  "Neumáticos",
  "Service",
] as const;

export type TurnoFormFieldsState = {
  titulo: string;
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
  const okTitulo = Boolean(state.titulo && state.titulo.trim().length > 0);
  const okCliente = input.isCreatingCliente ? state.clienteInlineIsValid : true;
  const okVehiculo = input.isCreatingVehiculo ? state.vehiculoInlineIsValid : true;
  const okFecha = /^\d{4}-\d{2}-\d{2}$/.test(state.fecha);
  const okHora = /^\d{2}:\d{2}$/.test(state.hora);
  return okTitulo && okCliente && okVehiculo && okFecha && okHora;
}

export function buildSuggestedTurnoTitle(params: {
  tipo?: string;
  vehiculo?: Vehiculo;
  cliente?: Cliente;
}): string {
  const parts: string[] = [];
  if (params.tipo) parts.push(params.tipo);
  if (params.vehiculo?.patente) {
    const veh = params.vehiculo.modelo
      ? `${params.vehiculo.patente} (${params.vehiculo.marca} ${params.vehiculo.modelo})`.trim()
      : params.vehiculo.patente;
    parts.push(veh);
  }
  if (params.cliente?.nombre) {
    parts.push(params.cliente.nombre);
  }
  return parts.join(" - ");
}

export default function TurnoFormFields(props: Props) {
  const { model, onChange, onValidityChange } = props;
  const { state, context } = model;
  const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(state);

  const [tituloManualmenteEditado, setTituloManualmenteEditado] = useState(false);
  const [ultimoTituloSugerido, setUltimoTituloSugerido] = useState("");

  const horarios = useTurnoHorarios(state.hora, state.duracion);

  const selectedCliente = useMemo(
    () =>
      !state.clienteId || isCreatingCliente
        ? undefined
        : context.clientes.find((c) => String(c.id) === state.clienteId),
    [context.clientes, state.clienteId, isCreatingCliente]
  );

  const selectedVehiculo = useMemo(
    () =>
      !state.vehiculoId || isCreatingVehiculo
        ? undefined
        : context.vehiculos.find((v) => String(v.id) === state.vehiculoId),
    [context.vehiculos, state.vehiculoId, isCreatingVehiculo]
  );

  const sugerirTitulo = (patch: { cliente?: Cliente; vehiculo?: Vehiculo; tipo?: string }) => {
    const cli = patch.cliente ?? selectedCliente;
    const veh = patch.vehiculo ?? selectedVehiculo;
    const tip = patch.tipo ?? state.tipo;
    const nuevoSugerido = buildSuggestedTurnoTitle({ cliente: cli, vehiculo: veh, tipo: tip });

    if (
      !tituloManualmenteEditado ||
      state.titulo.trim() === "" ||
      state.titulo === ultimoTituloSugerido
    ) {
      if (nuevoSugerido) {
        setUltimoTituloSugerido(nuevoSugerido);
        return nuevoSugerido;
      }
    }
    return undefined;
  };

  const isValid = useMemo(
    () => validateTurnoForm({ state, isCreatingCliente, isCreatingVehiculo }),
    [state, isCreatingCliente, isCreatingVehiculo]
  );

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  return (
    <div style={styles.container}>
      <TurnoClienteVehiculoFields
        state={state}
        context={context}
        onChange={onChange}
        selectedCliente={selectedCliente}
        selectedVehiculo={selectedVehiculo}
      />

      <div>
        <label style={styles.label}>
          Título{" "}
          <span aria-hidden="true" style={styles.required}>
            *
          </span>
        </label>
        <input
          type="text"
          style={styles.input}
          value={state.titulo}
          onChange={(e) => {
            setTituloManualmenteEditado(true);
            onChange({ titulo: e.target.value });
          }}
          placeholder="Ej: Service 10.000km, Revisión general, Cambio de aceite..."
        />
      </div>

      <div>
        <label style={styles.label}>
          Fecha y horario{" "}
          <span aria-hidden="true" style={styles.required}>
            *
          </span>
        </label>
        <TurnoDateTimePicker
          fecha={state.fecha}
          horarios={horarios}
          onChange={onChange}
        />
      </div>

      <div>
        <label style={styles.label}>Tipo de servicio</label>
        <Autocomplete
          options={TIPOS_TURNO.map((t) => ({ value: t, label: t }))}
          value={state.tipo}
          onChange={(v) => {
            const nuevoTitulo = sugerirTitulo({ tipo: v });
            onChange({ tipo: v, ...(nuevoTitulo ? { titulo: nuevoTitulo } : {}) });
          }}
          placeholder="Ej: Mecánica"
          allowCustomValue
        />
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
