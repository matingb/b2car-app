import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { InventarioProvider, useInventario } from "./InventarioProvider";

vi.mock("@/clients/stocksClient", () => ({
  stocksClient: {
    getByTaller: vi.fn(),
    getById: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { stocksClient } from "@/clients/stocksClient";

describe("InventarioProvider / useInventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stocksClient.getByTaller).mockResolvedValue({ data: [], error: null } as never);
  });

  it("carga inventario una sola vez por tallerId (evita loop de recarga)", async () => {
    renderHook(() => useInventario("T-1"), {
      wrapper: ({ children }) => <InventarioProvider>{children}</InventarioProvider>,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(stocksClient.getByTaller).toHaveBeenCalledTimes(1);
    expect(stocksClient.getByTaller).toHaveBeenCalledWith({ tallerId: "T-1" });
  });
});

