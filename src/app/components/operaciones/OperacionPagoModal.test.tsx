import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runPendingPromises } from "@/tests/testUtils";
import OperacionPagoModal from "./OperacionPagoModal";
import type { Operacion } from "@/model/types";

const mockRegistrarPago = vi.fn();
const mockAnularPago = vi.fn();
const mockFetchById = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockConfirm = vi.fn();

vi.mock("@/app/providers/OperacionesProvider", () => ({
  useOperaciones: () => ({
    registrarPago: mockRegistrarPago,
    anularPago: mockAnularPago,
    fetchById: mockFetchById,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: mockConfirm,
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [{ id: "cuenta-fav-1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true }],
    cuentaFavorita: { id: "cuenta-fav-1", nombre: "Caja Chica", tipo: "EFECTIVO", saldoActual: 10000, activo: true, favorita: true },
    loading: false,
    createCuenta: vi.fn(),
  }),
}));

vi.mock("@/app/components/finanzas/CuentaFinancieraAutocomplete", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    dataTestId,
  }: {
    value: string;
    onChange: (val: string) => void;
    dataTestId?: string;
  }) => (
    <input
      data-testid={dataTestId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  CREATE_CUENTA_VALUE: "__create_cuenta__",
}));

describe("OperacionPagoModal", () => {
  const operacion: Operacion = {
    id: "op-1",
    tipo: "VENTA",
    taller_id: "taller-1",
    fecha: "2026-10-21T12:00:00Z",
    created_at: "2026-10-21T12:00:00Z",
    monto_total: 10000,
    total_pagado: 4000,
    saldo_pendiente: 6000,
    esta_pago: false,
    estado_pago: "PARCIAL",
    estado_stock: "ENTREGADO",
    lineas: [],
    pagos: [
      {
        id: "pago-1",
        operacion_id: "op-1",
        cuenta_financiera_id: "cuenta-fav-1",
        cuenta_financiera_nombre: "Caja Chica",
        monto: 4000,
        fecha: "2026-10-21",
        descripcion: "Anticipo",
        created_at: "2026-10-21T12:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchById.mockResolvedValue(operacion);
  });

  it("renderiza el saldo pendiente y preselecciona la cuenta favorita en vista simple", async () => {
    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Gestión de cobros")).toBeInTheDocument();
    expect(screen.getByText("$6.000")).toBeInTheDocument();
    expect(screen.getByTestId("operacion-pago-simple")).toBeInTheDocument();
    expect(screen.getByText("Caja Chica")).toBeInTheDocument();
    expect(screen.getByText("Importe: $6.000")).toBeInTheDocument();
  });

  it("permite registrar un cobro por el saldo y llama a registrarPago", async () => {
    mockRegistrarPago.mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent("Cobrar $6.000");

    await userEvent.click(submitBtn);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockRegistrarPago).toHaveBeenCalledWith("op-1", expect.objectContaining({
        cuentaId: "cuenta-fav-1",
        monto: 6000,
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith("Cobro registrado", expect.any(String));
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("permite alternar a modo avanzado, editar monto y valida el saldo", async () => {
    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Alternar a avanzado
    const toggleBtn = screen.getByTestId("operacion-pago-advanced-toggle");
    await userEvent.click(toggleBtn);
    await runPendingPromises();

    const inputMonto = screen.getByTestId("pago-monto-0");
    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "0");

    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "7000");

    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    await userEvent.clear(inputMonto);
    await userEvent.type(inputMonto, "3000");

    expect(screen.getByTestId("modal-submit")).toBeEnabled();
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Cobrar $3.000");
  });

  it("calcula y renderiza el saldo pendiente si la operacion no trae saldo_pendiente explícito", async () => {
    const opSinSaldo: Operacion = {
      ...operacion,
      saldo_pendiente: undefined,
      monto_total: 15000,
      total_pagado: 5000,
    };
    mockFetchById.mockResolvedValue(opSinSaldo);

    render(
      <OperacionPagoModal
        open={true}
        operacion={opSinSaldo}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Gestión de cobros")).toBeInTheDocument();
    expect(screen.getByText("$10.000")).toBeInTheDocument();
    expect(screen.getByText("Importe: $10.000")).toBeInTheDocument();
    expect(screen.getByTestId("modal-submit")).toHaveTextContent("Cobrar $10.000");
  });

  it("cuando la operacion esta totalmente paga, muestra el banner de éxito, el historial de pagos y oculta el formulario de nuevo cobro", async () => {
    const opPagada: Operacion = {
      ...operacion,
      total_pagado: 10000,
      saldo_pendiente: 0,
      esta_pago: true,
      estado_pago: "PAGADO",
      pagos: [
        {
          id: "pago-1",
          operacion_id: "op-1",
          cuenta_financiera_id: "cuenta-fav-1",
          cuenta_financiera_nombre: "Caja Chica",
          monto: 10000,
          fecha: "2026-10-21",
          descripcion: "Pago total",
          created_at: "2026-10-21T12:00:00Z",
        },
      ],
    };
    mockFetchById.mockResolvedValue(opPagada);

    render(
      <OperacionPagoModal
        open={true}
        operacion={opPagada}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    expect(screen.getByTestId("operacion-pago-success-alert")).toBeInTheDocument();
    expect(screen.getByText(/totalmente cobrada/i)).toBeInTheDocument();
    expect(screen.getByTestId("operacion-pago-simple")).toBeInTheDocument();
    expect(screen.getByTestId("modal-submit")).toBeDisabled();

    // Historial presente
    expect(screen.getByTestId("operacion-pagos-historial-toggle")).toBeInTheDocument();
  });

  it("permite anular un pago registrado desde el historial", async () => {
    mockConfirm.mockResolvedValue(true);
    const updatedOp: Operacion = {
      ...operacion,
      total_pagado: 0,
      saldo_pendiente: 10000,
      pagos: [],
    };
    mockAnularPago.mockResolvedValue(updatedOp);
    mockFetchById.mockResolvedValueOnce(operacion).mockResolvedValue(updatedOp);
    const onSuccess = vi.fn();

    render(
      <OperacionPagoModal
        open={true}
        operacion={operacion}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await runPendingPromises();

    // Abrir historial
    await userEvent.click(screen.getByTestId("operacion-pagos-historial-toggle"));

    const anularBtn = screen.getByTestId("btn-anular-pago-pago-1");
    await userEvent.click(anularBtn);

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockAnularPago).toHaveBeenCalledWith("op-1", "pago-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("Cobro anulado", expect.any(String));
    expect(onSuccess).toHaveBeenCalledWith(updatedOp);
  });

  it("no entra en loop infinito ni refetchea al re-renderizar con nuevas referencias de operacion", async () => {
    const opPagada: Operacion = {
      ...operacion,
      total_pagado: 10000,
      saldo_pendiente: 0,
      esta_pago: true,
      estado_pago: "PAGADO",
      pagos: [],
    };
    mockFetchById.mockResolvedValue(opPagada);

    const { rerender } = render(
      <OperacionPagoModal
        open={true}
        operacion={{ ...opPagada }}
        onClose={vi.fn()}
      />
    );

    await runPendingPromises();

    // Simular re-renders del componente padre pasando nuevas referencias de objeto
    rerender(
      <OperacionPagoModal
        open={true}
        operacion={{ ...opPagada }}
        onClose={vi.fn()}
      />
    );
    await runPendingPromises();

    rerender(
      <OperacionPagoModal
        open={true}
        operacion={{ ...opPagada }}
        onClose={vi.fn()}
      />
    );
    await runPendingPromises();

    // fetchById sólo debe ser llamado 1 vez al abrirse el modal, no en cada re-render
    expect(mockFetchById).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("operacion-pago-success-alert")).toBeInTheDocument();
  });

  it("permite registrar un pago para una operacion de tipo GASTO diferido", async () => {
    mockRegistrarPago.mockResolvedValue(true);
    const onClose = vi.fn();
    const gastoOp: Operacion = {
      ...operacion,
      id: "op-gasto-1",
      tipo: "GASTO",
      monto_total: 8000,
      total_pagado: 0,
      saldo_pendiente: 8000,
      estado_pago: "PENDIENTE",
      pagos: [],
    };
    mockFetchById.mockResolvedValue(gastoOp);

    render(
      <OperacionPagoModal
        open={true}
        operacion={gastoOp}
        onClose={onClose}
      />
    );

    await runPendingPromises();

    expect(screen.getByText("Gestión de pagos")).toBeInTheDocument();
    expect(screen.getByTestId("summary-saldo")).toHaveTextContent("$8.000");

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveTextContent("Pagar $8.000");

    await userEvent.click(submitBtn);
    await runPendingPromises();

    await waitFor(() => {
      expect(mockRegistrarPago).toHaveBeenCalledWith("op-gasto-1", expect.objectContaining({
        cuentaId: "cuenta-fav-1",
        monto: 8000,
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith("Pago registrado", expect.any(String));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
