import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductosToolbar from "./ProductosToolbar";

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => mockToast,
}));

vi.mock("@/clients/productosClient", () => ({
  productosClient: {
    exportStockExcel: vi.fn(),
  },
}));

import { productosClient } from "@/clients/productosClient";

describe("ProductosToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el botón de exportar y ejecuta la descarga mostrando toast de éxito", async () => {
    vi.mocked(productosClient.exportStockExcel).mockResolvedValueOnce({ error: null });

    render(
      <ProductosToolbar
        search=""
        onSearchChange={vi.fn()}
        categoriasDisponibles={["Filtros", "Aceites"]}
        categorias={[]}
        onCategoriasChange={vi.fn()}
        showEsporadicos={false}
        onShowEsporadicosChange={vi.fn()}
      />
    );

    const exportBtn = screen.getByTestId("productos-export-excel-btn");
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(productosClient.exportStockExcel).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith(
        "Excel descargado",
        "El stock de productos se descargó correctamente."
      );
    });
  });

  it("muestra toast de error cuando la exportación falla", async () => {
    vi.mocked(productosClient.exportStockExcel).mockResolvedValueOnce({
      error: "Error del servidor",
    });

    render(
      <ProductosToolbar
        search=""
        onSearchChange={vi.fn()}
        categoriasDisponibles={["Filtros"]}
        categorias={[]}
        onCategoriasChange={vi.fn()}
        showEsporadicos={false}
        onShowEsporadicosChange={vi.fn()}
      />
    );

    const exportBtn = screen.getByTestId("productos-export-excel-btn");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(productosClient.exportStockExcel).toHaveBeenCalledTimes(1);
      expect(mockToast.error).toHaveBeenCalledWith("Error al exportar", "Error del servidor");
    });
  });
});
