import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CategoriasArregloPage, {
  CategoriasArregloContent,
} from "./page";

const mockUseCategoriasArreglo = vi.fn();
const mockConfirm = vi.fn();
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock("@/app/providers/CategoriasArregloProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/providers/CategoriasArregloProvider")>();
  return {
    ...actual,
    useCategoriasArreglo: () => mockUseCategoriasArreglo(),
  };
});

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
    alert: vi.fn(),
    isOpen: false,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => mockToast,
}));

describe("CategoriasArregloPage", () => {
  const defaultCategorias = [
    { id: "cat-1", nombre: "Frenos" },
    { id: "cat-2", nombre: "Service" },
  ];

  const mockCreateCategoria = vi.fn();
  const mockDeleteCategoria = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategoriasArreglo.mockReturnValue({
      categorias: defaultCategorias,
      isLoading: false,
      createCategoria: mockCreateCategoria,
      deleteCategoria: mockDeleteCategoria,
      loadCategorias: vi.fn(),
    });
  });

  it("renderiza el título, subtítulo y la lista de categorías con su contador", () => {
    render(<CategoriasArregloContent />);

    expect(screen.getByRole("heading", { name: "Categorías de arreglos" })).toBeInTheDocument();
    expect(screen.getByText("2 categorías registradas")).toBeInTheDocument();
    expect(screen.getByText("Frenos")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay categorías", () => {
    mockUseCategoriasArreglo.mockReturnValue({
      categorias: [],
      isLoading: false,
      createCategoria: mockCreateCategoria,
      deleteCategoria: mockDeleteCategoria,
      loadCategorias: vi.fn(),
    });

    render(<CategoriasArregloContent />);

    expect(screen.getByText("0 categorías registradas")).toBeInTheDocument();
    expect(screen.getByText("No hay categorías de arreglos registradas")).toBeInTheDocument();
  });

  it("permite agregar una categoría válida", async () => {
    mockCreateCategoria.mockResolvedValue({
      categoria: { id: "cat-3", nombre: "Chapa y pintura" },
      error: null,
    });

    render(<CategoriasArregloContent />);

    const input = screen.getByPlaceholderText(/Nombre de la nueva categoría/i);
    const submitBtn = screen.getByRole("button", { name: /Agregar categoría/i });

    fireEvent.change(input, { target: { value: "Chapa y pintura" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateCategoria).toHaveBeenCalledWith("Chapa y pintura");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Categoría creada",
        expect.stringContaining("Chapa y pintura")
      );
    });
  });

  it("rechaza agregar una categoría duplicada (case-insensitive) y muestra toast", async () => {
    render(<CategoriasArregloContent />);

    const input = screen.getByPlaceholderText(/Nombre de la nueva categoría/i);
    const submitBtn = screen.getByRole("button", { name: /Agregar categoría/i });

    fireEvent.change(input, { target: { value: "  frenos  " } });
    fireEvent.click(submitBtn);

    expect(mockCreateCategoria).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith(
      "Error de validación",
      "Ya existe una categoría de arreglo con ese nombre."
    );
  });

  it("muestra confirmación de eliminación con advertencia y ejecuta el borrado al aceptar", async () => {
    mockConfirm.mockResolvedValue(true);
    mockDeleteCategoria.mockResolvedValue({ error: null });

    render(<CategoriasArregloContent />);

    const deleteBtn = screen.getByRole("button", { name: "Eliminar categoría Frenos" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Eliminar categoría",
          acceptLabel: "Eliminar",
        })
      );
      expect(mockDeleteCategoria).toHaveBeenCalledWith("cat-1");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Categoría eliminada",
        expect.stringContaining("Frenos")
      );
    });
  });

  it("no ejecuta el borrado si el usuario cancela en el modal de confirmación", async () => {
    mockConfirm.mockResolvedValue(false);

    render(<CategoriasArregloContent />);

    const deleteBtn = screen.getByRole("button", { name: "Eliminar categoría Frenos" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(mockDeleteCategoria).not.toHaveBeenCalled();
  });

  it("renderiza el componente CategoriasArregloPage completo sin errores", async () => {
    let container: HTMLElement | null = null;
    await waitFor(() => {
      const res = render(<CategoriasArregloPage />);
      container = res.container;
    });
    expect(container).toBeInTheDocument();
  });
});
