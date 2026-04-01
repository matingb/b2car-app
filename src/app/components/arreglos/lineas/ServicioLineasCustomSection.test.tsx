import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicioLineasCustomSection, {
  type CustomServicioLineDef,
} from "./ServicioLineasCustomSection";

vi.mock("../../ui/Autocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
    inputStyle,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    inputStyle?: React.CSSProperties;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      style={inputStyle}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const lineDefs: CustomServicioLineDef[] = [
  {
    id: "frenos",
    title: "Frenos delanteros",
    descripcion: "Frenos delanteros",
    cantidad: 1,
    valor: 0,
    fields: [
      {
        key: "estado",
        label: "Estado",
        component: "select",
        required: true,
        options: [
          { value: "75%", label: "75%" },
          { value: "50%", label: "50%" },
        ],
      },
      {
        key: "rectificar",
        label: "Rectificar",
        component: "checkbox",
        required: true,
      },
      {
        key: "nota",
        label: "Nota",
        component: "textarea",
        placeholder: "Observaciones",
      },
    ],
  },
];

describe("ServicioLineasCustomSection", () => {
  it("actualiza el estado visual de la linea segun campos obligatorios", async () => {
    const onDetalleChange = vi.fn();

    render(
      <ServicioLineasCustomSection
        lineDefs={lineDefs}
        onDetalleChange={onDetalleChange}
      />
    );

    expect(screen.getByTestId("custom-line-status-frenos")).toHaveTextContent("Pendiente");

    fireEvent.change(screen.getByPlaceholderText("Seleccionar..."), {
      target: { value: "75%" },
    });

    expect(screen.getByTestId("custom-line-status-frenos")).toHaveTextContent("Incompleto");

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByTestId("custom-line-status-frenos")).toHaveTextContent("Completo");

    await waitFor(() => {
      expect(onDetalleChange).toHaveBeenLastCalledWith({
        costo: 0,
        metadata: [
          {
            title: "Frenos delanteros",
            inputs: [
              { title: "Estado", value: "75%" },
              { title: "Rectificar", value: false },
              { title: "Nota", value: null },
            ],
          },
        ],
      });
    });
  });

  it("muestra warning en required solo despues de cambios aplicados", () => {
    render(<ServicioLineasCustomSection lineDefs={lineDefs} />);

    const estadoInput = screen.getByPlaceholderText("Seleccionar...");

    expect(estadoInput).not.toHaveStyle(`border-color: #FF8C00`);

    fireEvent.change(estadoInput, {
      target: { value: "75%" },
    });
    fireEvent.change(estadoInput, {
      target: { value: "" },
    });

    expect(estadoInput).toHaveStyle(`border-color: #FF8C00`);
  });

  it("muestra borde warning cuando la linea ya esta incompleta con datos cargados", () => {
    render(
      <ServicioLineasCustomSection
        lineDefs={lineDefs}
        editableOnLoad={false}
        initialDetalle={{
          costo: 0,
          metadata: [
            {
              title: "Frenos delanteros",
              inputs: [
                { title: "Estado", value: "50%" },
                { title: "Rectificar", value: null },
                { title: "Nota", value: null },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId("custom-line-status-frenos")).toHaveTextContent("Incompleto");
    expect(
      screen
        .getAllByText("-")
        .find((element) => element.getAttribute("style")?.includes("border-color: rgb(255, 140, 0)"))
    ).toBeTruthy();
  });

  it("renderiza valores en modo lectura y confirma cambios al entrar en edicion", async () => {
    const onConfirmEdit = vi.fn();

    render(
      <ServicioLineasCustomSection
        lineDefs={lineDefs}
        editableOnLoad={false}
        showEditButton
        defaultCosto={25000}
        initialDetalle={{
          costo: 25000,
          metadata: [
            {
              title: "Frenos delanteros",
              inputs: [
                { title: "Estado", value: "50%" },
                { title: "Rectificar", value: false },
                { title: "Nota", value: "Revisar rotulas" },
              ],
            },
          ],
        }}
        onConfirmEdit={onConfirmEdit}
      />
    );

    expect(screen.getByTestId("custom-line-status-frenos")).toHaveTextContent("Completo");
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Revisar rotulas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar formulario" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));

    await waitFor(() => {
      expect(onConfirmEdit).toHaveBeenCalledWith({
        costo: 25000,
        metadata: [
          {
            title: "Frenos delanteros",
            inputs: [
              { title: "Estado", value: "50%" },
              { title: "Rectificar", value: false },
              { title: "Nota", value: "Revisar rotulas" },
            ],
          },
        ],
        items: [
          {
            id: "frenos",
            descripcion: "Frenos delanteros - Estado: 50% | Rectificar: No | Nota: Revisar rotulas",
            cantidad: 1,
            valor: 25000,
          },
        ],
      });
    });
  });
});
