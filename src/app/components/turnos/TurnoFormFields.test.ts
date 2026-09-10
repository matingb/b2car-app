import { describe, expect, it } from "vitest";
import { createEmptyClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";
import type { VehiculoFormFieldsValue } from "@/app/components/vehiculos/VehiculoFormFields";
import {
  CREATE_CLIENTE_VALUE,
  CREATE_VEHICULO_VALUE,
  getTurnoInlineFlags,
  validateTurnoForm,
  buildSuggestedTurnoTitle,
  type TurnoFormFieldsState,
} from "./TurnoFormFields";
import { TipoCliente, type Cliente, type Vehiculo } from "@/model/types";

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
  titulo: "Service 10.000km",
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

describe("buildSuggestedTurnoTitle", () => {
  it("construye sugerencia completa con tipo, patente, modelo y cliente", () => {
    const vehiculo: Vehiculo = {
      id: "v1",
      patente: "AB123CD",
      marca: "Ford",
      modelo: "Fiesta",
      nombre_cliente: "Juan Perez",
      fecha_patente: "",
      numero_chasis: "",
    };
    const cliente: Cliente = {
      id: "c1",
      nombre: "Juan Perez",
      tipo_cliente: TipoCliente.PARTICULAR,
      telefono: "12345",
      email: "juan@test.com",
      direccion: "",
    };
    const title = buildSuggestedTurnoTitle({ tipo: "Mecánica", vehiculo, cliente });
    expect(title).toBe("Mecánica - AB123CD (Ford Fiesta) - Juan Perez");
  });

  it("construye sugerencia sin vehículo", () => {
    const cliente: Cliente = {
      id: "c1",
      nombre: "Juan Perez",
      tipo_cliente: TipoCliente.PARTICULAR,
      telefono: "12345",
      email: "juan@test.com",
      direccion: "",
    };
    const title = buildSuggestedTurnoTitle({ tipo: "Service", cliente });
    expect(title).toBe("Service - Juan Perez");
  });
});

describe("validateTurnoForm", () => {
  [
    {
      name: "es válido cuando hay título, cliente, vehículo y fecha/hora válidos",
      state: base,
      expected: true,
    },
    {
      name: "es válido sin cliente ni vehículo mientras haya título y fecha/hora válidos",
      state: { ...base, clienteId: "", vehiculoId: "" },
      expected: true,
    },
    {
      name: "es inválido si no hay título",
      state: { ...base, titulo: "   " },
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
      state: { ...base, clienteId: CREATE_CLIENTE_VALUE, vehiculoId: "", clienteInlineIsValid: false },
      expected: false,
    },
    {
      name: "en modo crear vehículo, depende de vehiculoInlineIsValid",
      state: { ...base, vehiculoId: CREATE_VEHICULO_VALUE, vehiculoInlineIsValid: true },
      expected: true,
    },
    {
      name: "en modo crear vehículo, es inválido si vehiculoInlineIsValid=false",
      state: { ...base, vehiculoId: CREATE_VEHICULO_VALUE, vehiculoInlineIsValid: false },
      expected: false,
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
