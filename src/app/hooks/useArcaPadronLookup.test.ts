import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArcaPadronLookupQueryKey,
  isArcaPadronLookupReady,
  useArcaPadronLookup,
} from "./useArcaPadronLookup";

const fetchMock = vi.fn();

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("disparador automático de padrón ARCA", () => {
  it("se habilita al completar 8 dígitos para DNI", () => {
    expect(isArcaPadronLookupReady(96, "12.345.678")).toBe(true);
    expect(isArcaPadronLookupReady(96, "1234567")).toBe(false);
    expect(isArcaPadronLookupReady(96, "123456789")).toBe(false);
  });

  it("se habilita al completar 11 dígitos para CUIL o CUIT", () => {
    expect(isArcaPadronLookupReady(80, "20-12345678-6")).toBe(true);
    expect(isArcaPadronLookupReady(86, "27-12345678-2")).toBe(true);
    expect(isArcaPadronLookupReady(80, "2012345678")).toBe(false);
  });

  it("identifica cada respuesta por el documento consultado", () => {
    expect(getArcaPadronLookupQueryKey(96, "12.345.678"))
      .toBe("96:12345678");
    expect(getArcaPadronLookupQueryKey(96, "87.654.321"))
      .toBe("96:87654321");
  });

  it("cancela la consulta anterior cuando cambia el documento", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          status: "FOUND",
          person: { cuit: "27876543216", nombreCompleto: "Nueva persona" },
        },
      }), { status: 200 }));

    const { result, rerender } = renderHook(
      ({ documentNumber }) => useArcaPadronLookup({
        documentType: 96,
        documentNumber,
      }),
      { initialProps: { documentNumber: "12345678" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ documentNumber: "87654321" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    resolveFirst(new Response(JSON.stringify({
      data: {
        status: "FOUND",
        person: { cuit: "20123456786", nombreCompleto: "Respuesta vieja" },
      },
    }), { status: 200 }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toMatchObject({
      status: "FOUND",
      queryKey: "96:87654321",
      person: { cuit: "27876543216" },
    });
  });
});
