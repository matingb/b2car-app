import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const mockFetchCliente = vi.fn();

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => toast,
}));

vi.mock("@/app/providers/VehiculosProvider", () => ({
  useVehiculos: () => ({
    fetchCliente: mockFetchCliente,
  }),
}));

import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";

describe("useWhatsAppMessage", () => {
  beforeEach(() => {
    toast.success.mockClear();
    toast.error.mockClear();
    toast.info.mockClear();
    mockFetchCliente.mockReset();
  });

  it("si el mensaje está vacío, dispara toast error y no abre window", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useWhatsAppMessage());

    await act(async () => {
      await result.current.share("   ", "11 1234-5678");
    });

    expect(toast.error).toHaveBeenCalledWith("Error", "No se pudo generar el mensaje");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("si falta el teléfono, dispara toast error y no abre window", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useWhatsAppMessage());

    await act(async () => {
      await result.current.share("hola", undefined);
    });

    expect(toast.error).toHaveBeenCalledWith("Error", "El cliente no tiene teléfono cargado");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("si el teléfono es inválido, dispara toast error y no abre window", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useWhatsAppMessage());

    await act(async () => {
      await result.current.share("hola", "----");
    });

    expect(toast.error).toHaveBeenCalledWith("Error", "El teléfono del cliente no es válido");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("en caso exitoso, abre window con el link de WhatsApp", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({} as unknown as Window));
    const { result } = renderHook(() => useWhatsAppMessage());

    await act(async () => {
      await result.current.share("hola", "+54 9 11 1234-5678");
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0]!;
    expect(String(url)).toContain("https://api.whatsapp.com/send/");
    expect(String(url)).toContain("phone=5491112345678");
    expect(String(url)).toContain("text=hola");
    expect(target).toBe("_blank");
  });

  it("shareArreglo abre whatsapp con los datos del cliente y el arreglo", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({} as unknown as Window));
    mockFetchCliente.mockResolvedValueOnce({
      id: "cli1",
      nombre: "Juan",
      telefono: "1155554444",
    });

    const { result } = renderHook(() => useWhatsAppMessage());

    await act(async () => {
      await result.current.shareArreglo({
        arreglo: {
          id: "arr1",
          estado: "EN_PROGRESO",
          esta_pago: false,
          kilometraje_leido: 50000,
          observaciones: "",
          descripcion: "",
          taller_id: "taller1",
          taller: { id: "taller1", nombre: "Taller 1", ubicacion: "" },
          fecha: "2026-01-01",
          precio_final: 1000,
          precio_sin_iva: 1000,
          extra_data: "",
          vehiculo: {
            id: "veh1",
            patente: "AA123BB",
            marca: "Toyota",
            modelo: "Corolla",
            nombre_cliente: "Juan",
            cliente_id: "cli1",
            fecha_patente: "2020",
            numero_chasis: "123456",
          },
        },
        detalles: [],
        asignaciones: [],
        detalle_formulario: null,
      });
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(mockFetchCliente).toHaveBeenCalledWith("veh1");
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
