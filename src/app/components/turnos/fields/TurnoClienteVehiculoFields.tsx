"use client";

import React from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import ClienteFormFields from "@/app/components/clientes/ClienteFormFields";
import VehiculoFormFields, { type VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import { TipoCliente, type Cliente, type Vehiculo } from "@/model/types";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { turnoFormStyles as styles } from "@/app/components/turnos/TurnoFormFieldsStyles";
import type { ClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import {
  CREATE_CLIENTE_VALUE,
  CREATE_VEHICULO_VALUE,
  buildSuggestedTurnoTitle,
  getTurnoInlineFlags,
} from "@/app/components/turnos/TurnoFormFields";
import type { TurnoFormFieldsState, TurnoFormFieldsPatch, TurnoFormFieldsContext } from "@/app/components/turnos/TurnoFormFields";

type Props = {
  state: TurnoFormFieldsState;
  context: TurnoFormFieldsContext;
  onChange: (patch: TurnoFormFieldsPatch) => void;
  selectedCliente: Cliente | undefined;
  selectedVehiculo: Vehiculo | undefined;
};

export default function TurnoClienteVehiculoFields({
  state,
  context,
  onChange,
  selectedCliente,
  selectedVehiculo,
}: Props) {
  const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(state);

  const vehiculosFiltrados = selectedCliente
    ? context.vehiculos.filter(
        (v) => v.cliente_id != null && String(v.cliente_id) === String(selectedCliente.id)
      )
    : context.vehiculos;

  const vehiculoPlaceholder =
    vehiculosFiltrados.length === 0
      ? "No hay vehículos registrados para este cliente"
      : "Buscar o crear vehículo...";

  const clienteOptions: AutocompleteOption[] = [
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
  ];

  const vehiculoOptions: AutocompleteOption[] = [
    {
      value: CREATE_VEHICULO_VALUE,
      label: "+ Crear vehículo",
      secondaryLabel: "Cargar datos del vehículo nuevo",
    },
    ...vehiculosFiltrados.map((v) => {
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
    }),
  ];

  const sugerirTitulo = (patch: { cliente?: Cliente; vehiculo?: Vehiculo; tipo?: string }) => {
    const cli = patch.cliente ?? selectedCliente;
    const veh = patch.vehiculo ?? selectedVehiculo;
    const tip = patch.tipo ?? state.tipo;
    return buildSuggestedTurnoTitle({ cliente: cli, vehiculo: veh, tipo: tip }) || undefined;
  };

  const handleClienteChange = (v: string) => {
    const newCliente = context.clientes.find((c) => String(c.id) === v);
    const vehiculosDelCliente = newCliente
      ? context.vehiculos.filter(
          (veh) => veh.cliente_id != null && String(veh.cliente_id) === String(newCliente.id)
        )
      : [];
    const autoVehiculoId =
      vehiculosDelCliente.length === 1
        ? String(vehiculosDelCliente[0].id)
        : state.vehiculoId;
    const nextVehiculo = autoVehiculoId
      ? context.vehiculos.find((veh) => String(veh.id) === autoVehiculoId)
      : selectedVehiculo;
    const nuevoTitulo = sugerirTitulo({ cliente: newCliente, vehiculo: nextVehiculo });
    onChange({
      clienteId: v,
      vehiculoId: autoVehiculoId,
      ...(nuevoTitulo ? { titulo: nuevoTitulo } : {}),
    });
  };

  const handleVehiculoChange = (v: string) => {
    const newVehiculo = context.vehiculos.find((veh) => String(veh.id) === v);
    let autoClienteId = state.clienteId;
    let cli = selectedCliente;
    if (newVehiculo?.cliente_id && !state.clienteId) {
      autoClienteId = String(newVehiculo.cliente_id);
      cli = context.clientes.find((c) => String(c.id) === autoClienteId);
    }
    const nuevoTitulo = sugerirTitulo({ vehiculo: newVehiculo, cliente: cli });
    onChange({
      vehiculoId: v,
      clienteId: autoClienteId,
      ...(nuevoTitulo ? { titulo: nuevoTitulo } : {}),
    });
  };

  return (
    <>
      <div css={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            Cliente
          </label>
          <Autocomplete
            options={clienteOptions}
            value={state.clienteId}
            onChange={handleClienteChange}
            placeholder="Buscar cliente"
          />
        </div>

        {!isCreatingCliente && (
          <div style={styles.field}>
            <label style={styles.label}>
              Vehículo
            </label>
            <Autocomplete
              options={vehiculoOptions}
              value={state.vehiculoId}
              onChange={handleVehiculoChange}
              placeholder={vehiculoPlaceholder}
            />
          </div>
        )}
      </div>

      {isCreatingCliente && (
        <div style={styles.inlineForm}>
          <ClienteFormFields
            value={state.clienteDraft}
            onChange={(patch: Partial<ClienteFormFieldsValue>) => onChange({ clienteDraft: patch })}
            onValidityChange={({ isValid }) => {
              if (isValid !== state.clienteInlineIsValid) {
                onChange({ clienteInlineIsValid: isValid });
              }
            }}
          />
        </div>
      )}

      {(isCreatingVehiculo || isCreatingCliente) && (
        <div style={styles.inlineForm}>
          <VehiculoFormFields
            value={state.vehiculoDraft}
            onChange={(patch: Partial<VehiculoFormFieldsValue>) => onChange({ vehiculoDraft: patch })}
            showClienteInput={false}
            tipoCliente={
              selectedCliente?.tipo_cliente ??
              (isCreatingCliente ? state.clienteDraft.tipo_cliente : TipoCliente.PARTICULAR)
            }
            onValidityChange={(isValid) => {
              if (isValid !== state.vehiculoInlineIsValid) {
                onChange({ vehiculoInlineIsValid: isValid });
              }
            }}
          />
        </div>
      )}
    </>
  );
}
