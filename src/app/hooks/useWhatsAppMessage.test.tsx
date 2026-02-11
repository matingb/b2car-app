import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => toast,
}));

import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";

describe("useWhatsAppMessage", () => {
  beforeEach(() => {
    toast.success.mockClear();
    toast.error.mockClear();
    toast.info.mockClear();
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
});

