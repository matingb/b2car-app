import { describe, expect, it } from "vitest";
import { createEmptyClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import type { VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import {
  CREATE_CLIENTE_VALUE,
  CREATE_VEHICULO_VALUE,
  getTurnoInlineFlags,
  validateTurnoForm,
  type TurnoFormFieldsState,
} from "./TurnoFormFields";
import { TipoCliente } from "@/model/types";

const emptyVehiculoDraft: VehiculoFormFieldsValue = {
  cliente_id: "",
  patente: "",
  marca: "",
  modelo: "",
  fecha_patente: "",
  numero_chasis: "",
  nro_interno: "",
};

const base: TurnoFormFieldsState = {
  clienteId: "C-1",
  vehiculoId: "V-1",
  fecha: "2026-03-01",
  hora: "09:00",
  duracion: null,
  tipo: "Mecánica",
  descripcion: "",
  observaciones: "",
  clienteDraft: createEmptyClienteFormFieldsValue(),
  clienteInlineIsValid: false,
  vehiculoDraft: emptyVehiculoDraft,
  vehiculoInlineIsValid: false,
};

describe("getTurnoInlineFlags", () => {
  it("detecta modo crear cliente", () => {
    expect(getTurnoInlineFlags({ clienteId: CREATE_CLIENTE_VALUE, vehiculoId: "" })).toEqual({
      isCreatingCliente: true,
      isCreatingVehiculo: true,
    });
  });

  it("detecta modo crear vehículo", () => {
    expect(getTurnoInlineFlags({ clienteId: "C-1", vehiculoId: CREATE_VEHICULO_VALUE })).toEqual({
      isCreatingCliente: false,
      isCreatingVehiculo: true,
    });
  });
});

describe("validateTurnoForm", () => {
  [
    {
      name: "es válido cuando hay cliente y vehículo seleccionados y fecha/hora tienen formato válido",
      state: base,
      expected: true,
    },
    {
      name: "es inválido si no hay cliente seleccionado",
      state: { ...base, clienteId: "" },
      expected: false,
    },
    {
      name: "es inválido si no hay vehículo seleccionado",
      state: { ...base, vehiculoId: "" },
      expected: false,
    },
    {
      name: "en modo crear cliente (y vehículo), depende de clienteInlineIsValid y vehiculoInlineIsValid",
      state: {
        ...base,
        clienteId: CREATE_CLIENTE_VALUE,
        vehiculoId: "",
        clienteInlineIsValid: true,
        vehiculoInlineIsValid: true,
      },
      expected: true,
    },
    {
      name: "en modo crear cliente (y vehículo), es inválido si el vehículo no es válido",
      state: {
        ...base,
        clienteId: CREATE_CLIENTE_VALUE,
        vehiculoId: "",
        clienteInlineIsValid: true,
        vehiculoInlineIsValid: false,
      },
      expected: false,
    },
    {
      name: "en modo crear cliente, es inválido si clienteInlineIsValid=false",
      state: { ...base, clienteId: CREATE_CLIENTE_VALUE, vehiculoId: "" , clienteInlineIsValid: false },
      expected: false,
    },
    {
      name: "en modo crear vehículo, depende de vehiculoInlineIsValid",
      state: { ...base, vehiculoId: CREATE_VEHICULO_VALUE, vehiculoInlineIsValid: true },
      expected: true,
    },
    {
      name: "es inválido si la fecha no tiene formato yyyy-MM-dd",
      state: { ...base, fecha: "01/03/2026" },
      expected: false,
    },
    {
      name: "es inválido si la hora no tiene formato HH:mm",
      state: { ...base, hora: "9:00" },
      expected: false,
    },
  ].forEach(({ name, state, expected }) => {
    it("Dado un turno, al validar: " + name, () => {
      const { isCreatingCliente, isCreatingVehiculo } = getTurnoInlineFlags(state);
      expect(
        validateTurnoForm({
          state: { ...state, clienteDraft: { ...state.clienteDraft, tipo_cliente: TipoCliente.PARTICULAR } },
          isCreatingCliente,
          isCreatingVehiculo,
        })
      ).toBe(expected);
    });
  });
});

