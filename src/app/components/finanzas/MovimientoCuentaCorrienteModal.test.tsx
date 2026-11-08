import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "@/tests/testUtils";
import MovimientoCuentaCorrienteModal from "./MovimientoCuentaCorrienteModal";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { clientesClient } from "@/clients/clientes/clientesClient";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockRefreshCuentas = vi.fn();

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@/clients/proveedores/proveedoresClient", () => ({
  proveedoresClient: {
    registrarPagoDirecto: vi.fn(),
  },
}));

vi.mock("@/clients/clientes/clientesClient", () => ({
  clientesClient: {
    registrarMovimientoDirecto: vi.fn(),
  },
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
  CREATE_CUENTA_VALUE: "create_new",
}));

const mockCuentas = [
  {
    id: "cta-banco-1",
    nombre: "Banco Galicia",
    tipo: "BANCO",
    saldoActual: 250000,
    activo: true,
    favorita: true,
  },
  {
    id: "cta-caja-2",
    nombre: "Caja Chica",
    tipo: "EFECTIVO",
    saldoActual: 50000,
    activo: true,
    favorita: false,
  },
];

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: mockCuentas,
    cuentasActivas: mockCuentas,
    cuentaFavorita: mockCuentas[0],
    loading: false,
    createCuenta: vi.fn(),
    refresh: mockRefreshCuentas,
  }),
}));

describe("MovimientoCuentaCorrienteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite registrar un pago directo a proveedor en 1 click con la cuenta favorita", async () => {
    vi.mocked(proveedoresClient.registrarPagoDirecto).mockResolvedValue({
      data: { id: "pago-1", ok: true },
      error: null,
    });

    const onSuccess = vi.fn();

    render(
      <MovimientoCuentaCorrienteModal
        open={true}
        entidad="PROVEEDOR"
        contraparteId="prov-10"
        contraparteNombre="Filtros Warnes"
        saldoActual={75000}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Registrar pago a cuenta corriente")).toBeInTheDocument();
    expect(screen.getByText("Filtros Warnes")).toBeInTheDocument();
    expect(screen.getByText(/El pago se debitará de la cuenta favorita/)).toBeInTheDocument();

    const submitBtn = screen.getByTestId("modal-submit");
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(proveedoresClient.registrarPagoDirecto).toHaveBeenCalledTimes(1);
    });

    const [calledProvId, payload] = vi.mocked(proveedoresClient.registrarPagoDirecto).mock.calls[0];
    expect(calledProvId).toBe("prov-10");
    expect(payload.sentido).toBe("PAGO");
    expect(payload.monto).toBe(75000);
    expect(payload.cuentaId).toBe("cta-banco-1");
    expect(mockRefreshCuentas).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("permite alternar a Cobro / Reintegro en proveedor y dividir o ingresar monto", async () => {
    vi.mocked(proveedoresClient.registrarPagoDirecto).mockResolvedValue({
      data: { id: "cobro-prov-1", ok: true },
      error: null,
    });

    const onSuccess = vi.fn();

    render(
      <MovimientoCuentaCorrienteModal
        open={true}
        entidad="PROVEEDOR"
        contraparteId="prov-10"
        contraparteNombre="Filtros Warnes"
        saldoActual={75000}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    const cobroToggle = screen.getByTestId("movimiento-cc-sentido-cobro");
    await userEvent.click(cobroToggle);

    expect(
      screen.getByText("Registrar cobro / reintegro en cuenta corriente")
    ).toBeInTheDocument();

    const monto0 = screen.getByTestId("pago-monto-0");
    await userEvent.type(monto0, "15000");

    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(proveedoresClient.registrarPagoDirecto).toHaveBeenCalledTimes(1);
    });

    const [, payload] = vi.mocked(proveedoresClient.registrarPagoDirecto).mock.calls[0];
    expect(payload.sentido).toBe("COBRO");
    expect(payload.monto).toBe(15000);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("permite dividir en múltiples cuentas financieras", async () => {
    vi.mocked(proveedoresClient.registrarPagoDirecto).mockResolvedValue({
      data: { id: "pago-mult-1", ok: true },
      error: null,
    });

    const onSuccess = vi.fn();

    render(
      <MovimientoCuentaCorrienteModal
        open={true}
        entidad="PROVEEDOR"
        contraparteId="prov-10"
        contraparteNombre="Filtros Warnes"
        saldoActual={75000}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await userEvent.click(screen.getByTestId("movimiento-cc-advanced-toggle"));

    const monto0 = screen.getByTestId("pago-monto-0");
    await userEvent.clear(monto0);
    await userEvent.type(monto0, "50000");

    await userEvent.click(screen.getByTestId("btn-add-account"));
    fireEvent.change(screen.getByTestId("pago-cuenta-1"), { target: { value: "cta-caja-2" } });

    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(proveedoresClient.registrarPagoDirecto).toHaveBeenCalledTimes(1);
    });

    const [, payload] = vi.mocked(proveedoresClient.registrarPagoDirecto).mock.calls[0];
    expect(payload.pagos).toHaveLength(2);
    expect(payload.pagos?.[0]).toEqual(expect.objectContaining({ cuentaId: "cta-banco-1", monto: 50000 }));
    expect(payload.pagos?.[1]).toEqual(expect.objectContaining({ cuentaId: "cta-caja-2", monto: 25000 }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("permite registrar cobro directo y pago/devolución en cliente", async () => {
    vi.mocked(clientesClient.registrarMovimientoDirecto).mockResolvedValue({
      data: { id: "op-cli-1", ok: true },
      error: null,
    });

    const onSuccess = vi.fn();

    render(
      <MovimientoCuentaCorrienteModal
        open={true}
        entidad="CLIENTE"
        contraparteId="cli-10"
        contraparteNombre="Logística Central S.A."
        saldoActual={0}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await userEvent.click(screen.getByTestId("movimiento-cc-sentido-pago"));
    expect(screen.getByText("Registrar pago / devolución a cliente")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("pago-monto-0"), "35000");
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => {
      expect(clientesClient.registrarMovimientoDirecto).toHaveBeenCalledTimes(1);
    });

    const [calledCliId, payload] = vi.mocked(clientesClient.registrarMovimientoDirecto).mock.calls[0];
    expect(calledCliId).toBe("cli-10");
    expect(payload.sentido).toBe("PAGO");
    expect(payload.monto).toBe(35000);
    expect(payload.cuentaId).toBe("cta-banco-1");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

