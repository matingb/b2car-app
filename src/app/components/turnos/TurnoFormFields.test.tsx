import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TurnoFormFields, { type TurnoFormFieldsModel } from "./TurnoFormFields";
import { createEmptyClienteFormFieldsValue } from "@/app/components/clientes/ClienteFormFields";

describe("TurnoFormFields - Componente UI", () => {
  const model: TurnoFormFieldsModel = {
    state: {
      titulo: "Revisión técnica",
      clienteId: "",
      vehiculoId: "",
      fecha: "2026-09-09",
      hora: "09:00",
      duracion: 60,
      tipo: "Mecánica",
      descripcion: "",
      observaciones: "",
      clienteDraft: createEmptyClienteFormFieldsValue(),
      clienteInlineIsValid: false,
      vehiculoDraft: {
        cliente_id: "",
        patente: "",
        marca: "",
        modelo: "",
        fecha_patente: "",
        numero_chasis: "",
        nro_interno: "",
      },
      vehiculoInlineIsValid: false,
    },
    context: {
      clientes: [],
      vehiculos: [],
    },
  };

  it("renderiza la píldora de fecha y los dropdowns de hora desde y hasta en desktop", () => {
    render(<TurnoFormFields model={model} onChange={vi.fn()} />);

    expect(screen.getByText(/miércoles.*9.*septiembre/i)).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-desde")).toHaveTextContent("09:00");
    expect(screen.getByTestId("turno-hora-hasta")).toHaveTextContent("10:00");
    expect(screen.getByTestId("turno-hora-hasta")).not.toHaveTextContent("10:00 (1 h)");
    expect(screen.getByRole("checkbox", { name: "Todo el día" })).not.toBeChecked();
  });

  it("renderiza el formato mobile con fecha corta, toggle switch y fila de horarios Desde/Hasta", () => {
    render(<TurnoFormFields model={model} onChange={vi.fn()} />);

    // 1 fila de fecha mobile con formato corto "Mié, 9 Sep 2026"
    expect(screen.getAllByText(/mié,\s*9\s*sep/i).length).toBe(1);
    expect(screen.getByText("Desde:")).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-desde-mobile")).toHaveTextContent("9:00 am");
    expect(screen.getByText("Hasta:")).toBeInTheDocument();
    expect(screen.getByTestId("turno-hora-hasta-mobile")).toHaveTextContent("10:00 am");
    expect(screen.getByRole("switch", { name: "Todo el día" })).toHaveAttribute("aria-checked", "false");
  });

  it("cuando Todo el día está activo en mobile no muestra los dropdowns ni etiquetas de hora pero mantiene la fecha", () => {
    const allDayModel = {
      ...model,
      state: {
        ...model.state,
        hora: "06:00",
        duracion: 960,
      },
    };
    render(<TurnoFormFields model={allDayModel} onChange={vi.fn()} />);

    expect(screen.getAllByText(/mié,\s*9\s*sep/i).length).toBe(1);
    expect(screen.queryByText("Desde:")).not.toBeInTheDocument();
    expect(screen.queryByText("Hasta:")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turno-hora-desde-mobile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turno-hora-hasta-mobile")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Todo el día" })).toHaveAttribute("aria-checked", "true");
  });

  it("al marcar Todo el día en desktop emite hora 06:00 y duración 960", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Todo el día" });
    await userEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      hora: "06:00",
      duracion: 960,
    });
  });

  it("al alternar el switch de Todo el día en mobile emite hora 06:00 y duración 960", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Todo el día" });
    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      hora: "06:00",
      duracion: 960,
    });
  });

  it("al cambiar la hora desde mediante el dropdown emite la nueva hora", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const triggerDesde = screen.getByTestId("turno-hora-desde");
    await userEvent.click(triggerDesde);

    const opcion1030 = screen.getByRole("option", { name: "10:30" });
    await userEvent.click(opcion1030);

    expect(onChange).toHaveBeenCalledWith({
      hora: "10:30",
    });
  });

  it("al cambiar la hora hasta mediante el dropdown calcula y emite la nueva duración", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const triggerHasta = screen.getByTestId("turno-hora-hasta");
    await userEvent.click(triggerHasta);

    const opcion1100 = screen.getByRole("option", { name: "11:00 (2 h)" });
    expect(opcion1100).toBeInTheDocument();
    await userEvent.click(opcion1100);

    // De 09:00 a 11:00 son 120 minutos
    expect(onChange).toHaveBeenCalledWith({
      duracion: 120,
    });
  });

  it("al hacer clic en la píldora de fecha abre el calendario y permite seleccionar una nueva fecha", async () => {
    const onChange = vi.fn();
    render(<TurnoFormFields model={model} onChange={onChange} />);

    const pill = screen.getByText(/miércoles.*9.*septiembre/i);
    await userEvent.click(pill);

    expect(screen.getByRole("dialog", { name: "Selector de fecha" })).toBeInTheDocument();

    const dia15 = screen.getByRole("button", { name: "15 de Septiembre" });
    await userEvent.click(dia15);

    expect(onChange).toHaveBeenCalledWith({
      fecha: "2026-09-15",
    });
  });
});
