import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArregloWhatsAppModal from "./ArregloWhatsAppModal";
import { createArreglo, createArregloDetalleData, createVehiculo } from "@/tests/factories";

const mocks = vi.hoisted(() => ({
  fetchCliente: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    fetchCliente: mocks.fetchCliente,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}));

describe("ArregloWhatsAppModal", () => {
  const sampleData = createArregloDetalleData({
    arreglo: createArreglo({
      id: "a1",
      kilometraje_leido: 75000,
      observaciones: "Ruido en tren delantero",
      precio_final: 0,
      vehiculo: createVehiculo({ id: "v1", patente: "ABC123" }),
    }),
    detalles: [
      {
        id: "d1",
        arreglo_id: "a1",
        descripcion: "Mano de obra frenos",
        cantidad: 1,
        valor: 12000,
        categoria_arreglo_id: null,
        empleado_id: null,
      },
    ],
    asignaciones: [
      {
        id: "op1",
        tipo: "egreso",
        taller_id: "t1",
        created_at: "2026-01-01",
        lineas: [
          {
            id: "l1",
            operacion_id: "op1",
            stock_id: "s1",
            cantidad: 2,
            monto_unitario: 8000,
            delta_cantidad: -2,
            created_at: "2026-01-01",
            categoria_arreglo_id: null,
            empleado_id: null,
            producto: { id: "p1", codigo: "PAS-01", nombre: "Pastillas de freno" },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchCliente.mockResolvedValue({
      id: "c1",
      nombre: "Carlos Gómez",
      codigo_pais: "+54",
      telefono: "91198765432",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza el modal con toggles iniciales (Agrupado por defecto) y datos del cliente", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    expect(screen.getByText("Compartir por WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Configuración del contenido:")).toBeInTheDocument();

    // Debe cargar el cliente
    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const phoneInput = screen.getByLabelText("Teléfono WhatsApp:") as HTMLInputElement;
    expect(phoneInput.value).toBe("5491198765432");

    // Por defecto: Detalle ON, Precios OFF, Subtotales ON, Total ON
    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("_Subtotal repuestos: $16.000_");
    expect(textarea.value).toContain("_Subtotal mano de obra: $12.000_");
    expect(textarea.value).toContain("• Pastillas de freno x2");
    expect(textarea.value).not.toContain("• Pastillas de freno x2 - $16.000");
    expect(textarea.value).toContain("*Total arreglo $28.000*");
  });

  it("permite apagar el detalle de ítems para mostrar solo resumen de montos", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const toggleDetalle = screen.getByRole("checkbox", { name: "Detalle de repuestos y servicios" });
    fireEvent.click(toggleDetalle);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("💰 *Resumen:*");
    expect(textarea.value).toContain("• Repuestos: $16.000");
    expect(textarea.value).toContain("• Mano de obra: $12.000");
    expect(textarea.value).not.toContain("Pastillas de freno");
    expect(textarea.value).not.toContain("Mano de obra frenos");
    expect(textarea.value).toContain("*Total arreglo $28.000*");
  });

  it("permite prender precios individuales por ítem", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const togglePrecios = screen.getByRole("checkbox", { name: "Precios individuales por ítem" });
    fireEvent.click(togglePrecios);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("• Pastillas de freno x2 - $16.000");
    expect(textarea.value).toContain("• Mano de obra frenos x1 - $12.000");
  });

  it("permite apagar el total general", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const toggleTotal = screen.getByRole("checkbox", { name: "Total general" });
    fireEvent.click(toggleTotal);

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).not.toContain("*Total arreglo");
  });

  it("permite alternar el toggle de kilometraje", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("⏱️ KM actual 75000");

    const toggleKm = screen.getByRole("checkbox", { name: "Kilometraje actual" });
    fireEvent.click(toggleKm);

    expect(textarea.value).not.toContain("⏱️ KM actual");
  });

  it("permite alternar el toggle de observaciones", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("📝 Observaciones: Ruido en tren delantero");

    const toggleObs = screen.getByRole("checkbox", { name: "Observaciones generales" });
    fireEvent.click(toggleObs);

    expect(textarea.value).not.toContain("📝 Observaciones:");
  });

  it("permite editar el texto a mano y luego restablecerlo", async () => {
    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("El mensaje de WhatsApp aparecerá aquí...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Mensaje personalizado para Carlos" } });

    expect(screen.getByText("Editado manualmente")).toBeInTheDocument();
    expect(textarea.value).toBe("Mensaje personalizado para Carlos");

    // Restablecer
    fireEvent.click(screen.getByTitle("Restablecer mensaje original según toggles"));
    expect(screen.queryByText("Editado manualmente")).not.toBeInTheDocument();
    expect(textarea.value).toContain("_Subtotal repuestos: $16.000_");
  });

  it("copia el mensaje al portapapeles", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ArregloWhatsAppModal
        open
        onClose={vi.fn()}
        data={sampleData}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const copyBtn = screen.getByTitle("Copiar texto al portapapeles");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText("¡Copiado!")).toBeInTheDocument();
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Copiado", expect.any(String));
    });
  });

  it("envía por WhatsApp abriendo la ventana con la URL correspondiente", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    const onClose = vi.fn();

    render(
      <ArregloWhatsAppModal
        open
        onClose={onClose}
        data={sampleData}
        initialPhone="5491199998888"
        clienteNombre="Carlos Gómez"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Contacto: Carlos Gómez")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: "Enviar WhatsApp" });
    fireEvent.click(submitBtn);

    expect(openSpy).toHaveBeenCalled();
    const calledUrl = openSpy.mock.calls[0][0];
    expect(calledUrl).toContain("https://api.whatsapp.com/send/");
    expect(calledUrl).toContain("phone=5491199998888");
    expect(onClose).toHaveBeenCalled();
  });
});
