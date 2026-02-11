import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClienteFormModal from "./ClienteFormModal";

const mockValidity = vi.hoisted(() => ({ isValid: false }));

vi.mock("./ClienteFormFields", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ClienteFormFields")>();
  const React = await import("react");
  const ClienteFormFieldsMock = ({
    onValidityChange,
  }: {
    onValidityChange?: (v: { isValid: boolean; errors: Record<string, string> }) => void;
  }) => {
    React.useEffect(() => {
      onValidityChange?.({ isValid: mockValidity.isValid, errors: {} });
    }, [onValidityChange]);

    return <div data-testid="cliente-form-fields-mock" />;
  };

  return {
    __esModule: true,
    ...actual,
    default: ClienteFormFieldsMock,
  };
});

const onClose = vi.fn();
const onSubmit = vi.fn();

describe("ClienteFormModal", () => {
  it("deshabilita submit cuando el formulario es inválido", () => {
    mockValidity.isValid = false;

    render(<ClienteFormModal open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByTestId("modal-submit")).toBeDisabled();
  });

  it("habilita submit cuando el formulario es válido", () => {
    mockValidity.isValid = true;

    render(<ClienteFormModal open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByTestId("modal-submit")).not.toBeDisabled();
  });
});

