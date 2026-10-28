"use client";

import React from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import ClienteAutocomplete, { CREATE_CLIENTE_VALUE } from "@/app/components/clientes/ClienteAutocomplete";
import ClienteFormFields from "@/app/components/clientes/ClienteFormFields";
import VehiculoFormFields, { type VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import { TipoCliente, type Cliente, type Vehiculo } from "@/model/types";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { turnoFormStyles as styles } from "@/app/components/turnos/TurnoFormFieldsStyles";
import type { ClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import {
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
  onClienteSelected: (cliente: Cliente | undefined) => void;
};

export default function TurnoClienteVehiculoFields({
  state,
  context,
  onChange,
  selectedCliente,
  selectedVehiculo,
  onClienteSelected,
}: Props) {
  const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(state);

  const vehiculosDelCliente = (clienteId: string) =>
    context.vehiculos.filter(
      (v) => v.cliente_id != null && String(v.cliente_id) === clienteId
    );

  // Filtrar por el ID elegido aunque el cliente todavía se esté resolviendo.
  const selectedClienteId = !state.clienteId || isCreatingCliente ? "" : state.clienteId;
  const vehiculosFiltrados = selectedClienteId
    ? vehiculosDelCliente(selectedClienteId)
    : context.vehiculos;

  const vehiculoPlaceholder =
    vehiculosFiltrados.length === 0
      ? "No hay vehículos registrados"
      : "Buscar o crear vehículo...";

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

  // Una clave presente con valor undefined descarta la referencia actual.
  const sugerirTitulo = (patch: {
    cliente?: Pick<Cliente, "nombre">;
    vehiculo?: Vehiculo;
    tipo?: string;
  }) => {
    const cli = "cliente" in patch ? patch.cliente : selectedCliente;
    const veh = "vehiculo" in patch ? patch.vehiculo : selectedVehiculo;
    const tip = patch.tipo ?? state.tipo;
    return buildSuggestedTurnoTitle({ cliente: cli, vehiculo: veh, tipo: tip }) || undefined;
  };

  const resolveVehiculoIdParaCliente = (clienteId: string) => {
    if (state.vehiculoId === CREATE_VEHICULO_VALUE) return state.vehiculoId;
    const propios = vehiculosDelCliente(clienteId);
    if (propios.length === 1) return String(propios[0].id);
    if (selectedVehiculo && String(selectedVehiculo.cliente_id) !== clienteId) return "";
    return state.vehiculoId;
  };

  const handleClienteChange = (v: string, cliente?: Cliente) => {
    const isClienteExistente = Boolean(v) && v !== CREATE_CLIENTE_VALUE;
    const newCliente = isClienteExistente
      ? cliente ?? context.clientes.find((c) => String(c.id) === v)
      : undefined;
    onClienteSelected(newCliente);

    const nextVehiculoId = isClienteExistente
      ? resolveVehiculoIdParaCliente(v)
      : state.vehiculoId;
    const nextVehiculo =
      v !== CREATE_CLIENTE_VALUE && nextVehiculoId
        ? context.vehiculos.find((veh) => String(veh.id) === nextVehiculoId)
        : undefined;
    const nuevoTitulo = sugerirTitulo({ cliente: newCliente, vehiculo: nextVehiculo });
    onChange({
      clienteId: v,
      vehiculoId: nextVehiculoId,
      ...(nuevoTitulo ? { titulo: nuevoTitulo } : {}),
    });
  };

  const handleVehiculoChange = (v: string) => {
    const newVehiculo = context.vehiculos.find((veh) => String(veh.id) === v);
    let autoClienteId = state.clienteId;
    let cli: Pick<Cliente, "nombre"> | undefined = selectedCliente;
    if (newVehiculo?.cliente_id && !state.clienteId) {
      autoClienteId = String(newVehiculo.cliente_id);
      // El dueño puede no estar en el listado inicial; TurnoFormFields lo resuelve por ID.
      cli =
        context.clientes.find((c) => String(c.id) === autoClienteId) ??
        (newVehiculo.nombre_cliente ? { nombre: newVehiculo.nombre_cliente } : undefined);
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
          <ClienteAutocomplete
            value={state.clienteId}
            onChange={handleClienteChange}
            clientes={context.clientes}
            allowCreate
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
