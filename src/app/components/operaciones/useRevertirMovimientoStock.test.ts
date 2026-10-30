import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  canRevertirMovimiento,
  isMovimientoReversion,
  isMovimientoRevertido,
  useRevertirMovimientoStock,
} from "./useRevertirMovimientoStock";
import type { Operacion, OperacionMovimientoStock } from "@/model/types";

const mockRevertirStock = vi.fn();
const mockConfirm = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    revertirStock: mockRevertirStock,
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

describe("useRevertirMovimientoStock & helpers", () => {
  const movNormal: OperacionMovimientoStock = {
    id: "mov-1",
    fecha: "2026-10-21T14:00:00Z",
    cantidad: -5,
    saldo_anterior: 10,
    saldo_posterior: 5,
    motivo: "Entrega inicial",
    created_at: "2026-10-21T14:00:00Z",
    producto_id: "prod-1",
    stock_id: "stock-1",
    producto_nombre: "Filtro de Aceite",
  };

  const movReversion: OperacionMovimientoStock = {
    id: "mov-rev",
    fecha: "2026-10-21T15:00:00Z",
    cantidad: 5,
    saldo_anterior: 5,
    saldo_posterior: 10,
    motivo: "Reversión de entrega",
    created_at: "2026-10-21T15:00:00Z",
    producto_id: "prod-1",
    stock_id: "stock-1",
    tipo_movimiento: "REVERSION",
    reversion_de_id: "mov-1",
  };

  const operacionVenta: Operacion = {
    id: "op-1",
    tipo: "VENTA",
    taller_id: "t-1",
    fecha: "2026-10-21T10:00:00Z",
    created_at: "2026-10-21T10:00:00Z",
    monto_total: 10000,
    total_pagado: 10000,
    saldo_pendiente: 0,
    esta_pago: true,
    estado_pago: "PAGADO",
    estado_stock: "ENTREGADO",
    lineas: [],
    movimientos_stock: [movNormal],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("helpers", () => {
    it("isMovimientoReversion detecta reversiones por tipo, id o motivo", () => {
      expect(isMovimientoReversion(movReversion)).toBe(true);
      expect(isMovimientoReversion(movNormal)).toBe(false);
      expect(
        isMovimientoReversion({
          ...movNormal,
          motivo: "Reversión manual por error",
        })
      ).toBe(true);
    });

    it("isMovimientoRevertido detecta si el movimiento fue revertido", () => {
      expect(isMovimientoRevertido({ ...movNormal, revertido: true })).toBe(true);
      expect(isMovimientoRevertido(movNormal, [movNormal, movReversion])).toBe(true);
      expect(isMovimientoRevertido(movNormal, [movNormal])).toBe(false);
    });

    it("canRevertirMovimiento solo permite movimientos activos no reversiones", () => {
      expect(canRevertirMovimiento(movNormal)).toBe(true);
      expect(canRevertirMovimiento(movReversion)).toBe(false);
      expect(canRevertirMovimiento({ ...movNormal, revertido: true })).toBe(false);
      expect(canRevertirMovimiento(movNormal, [movNormal, movReversion])).toBe(false);
    });
  });

  describe("hook flow", () => {
    it("ejecuta el flujo completo de confirmación y llamada a revertirStock", async () => {
      mockConfirm.mockResolvedValue(true);
      const updatedOp = { ...operacionVenta, estado_stock: "PENDIENTE" as const };
      mockRevertirStock.mockResolvedValue(updatedOp);
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useRevertirMovimientoStock({ operacion: operacionVenta, onSuccess })
      );

      await act(async () => {
        await result.current.handleRevertirMovimiento("mov-1", 5, "Filtro de Aceite");
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "¿Revertir la entrega?",
          message: expect.stringContaining("5 u. de \"Filtro de Aceite\""),
          acceptLabel: "Revertir",
          cancelLabel: "Cancelar",
        })
      );
      expect(mockRevertirStock).toHaveBeenCalledWith("op-1", "mov-1");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Entrega revertida",
        expect.stringContaining("5 u.")
      );
      expect(onSuccess).toHaveBeenCalledWith(updatedOp);
    });

    it("cancela la reversión si el usuario rechaza la confirmación", async () => {
      mockConfirm.mockResolvedValue(false);
      const { result } = renderHook(() =>
        useRevertirMovimientoStock({ operacion: operacionVenta })
      );

      await act(async () => {
        await result.current.handleRevertirMovimiento("mov-1", 5);
      });

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockRevertirStock).not.toHaveBeenCalled();
    });

    it("bloquea reversión si el movimiento ya es una reversión o está revertido", async () => {
      const opConReversion: Operacion = {
        ...operacionVenta,
        movimientos_stock: [movNormal, movReversion],
      };

      const { result } = renderHook(() =>
        useRevertirMovimientoStock({ operacion: opConReversion })
      );

      await act(async () => {
        await result.current.handleRevertirMovimiento("mov-rev");
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Operación no permitida",
        expect.stringContaining("ya es una reversión")
      );
      expect(mockConfirm).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.handleRevertirMovimiento("mov-1");
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Operación no permitida",
        expect.stringContaining("ya fue revertido")
      );
      expect(mockConfirm).not.toHaveBeenCalled();
    });
  });
});
