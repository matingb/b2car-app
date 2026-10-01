import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CuentaFinanciera } from "@/model/finanzas";

const obtenerCuenta = vi.fn();
const listarMovimientos = vi.fn();
const listarCuentas = vi.fn();
const crearIngresoManual = vi.fn();
const crearGasto = vi.fn();
const crearCuenta = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/app/components/ui/ScreenHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="screen-header" />,
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({ confirm: vi.fn().mockResolvedValue(false) }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

vi.mock("@/clients/finanzasClient", () => ({
  finanzasClient: {
    obtenerCuenta: (...args: unknown[]) => obtenerCuenta(...args),
    listarMovimientos: (...args: unknown[]) => listarMovimientos(...args),
    listarCuentas: (...args: unknown[]) => listarCuentas(...args),
    actualizarCuenta: vi.fn(),
    eliminarCuenta: vi.fn(),
    crearCuenta: (...args: unknown[]) => crearCuenta(...args),
    crearGasto: (...args: unknown[]) => crearGasto(...args),
    crearTransferencia: vi.fn(),
    crearIngresoManual: (...args: unknown[]) => crearIngresoManual(...args),
  },
}));

import { CuentasFinancierasProvider } from "@/app/providers/CuentasFinancierasProvider";
import CuentaFinancieraDetailPage from "./page";

const cuenta: CuentaFinanciera = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Caja principal",
  tipo: "EFECTIVO",
  saldoInicial: 1000,
  saldoActual: 1500,
  activo: true,
  favorita: true,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

describe("CuentaFinancieraDetailPage", () => {
  beforeEach(() => {
    obtenerCuenta.mockReset();
    listarMovimientos.mockReset();
    listarCuentas.mockReset();
    crearIngresoManual.mockReset();
    crearGasto.mockReset();
    crearCuenta.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    obtenerCuenta.mockResolvedValue({ data: cuenta, error: null });
    listarMovimientos.mockResolvedValue({ data: [], error: null });
    listarCuentas.mockResolvedValue({ data: [cuenta], error: null });
  });

  it("registra un gasto desde el detalle sin navegar y actualiza el historial", async () => {
    crearGasto.mockResolvedValue({
      data: { id: "gasto-1", cuentaId: cuenta.id, categoria: "ALQUILER", importe: 250 },
      error: null,
    });
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    const urlBefore = window.location.href;
    const nuevoGasto = await screen.findByTestId("cuenta-financiera-nuevo-gasto");
    expect(nuevoGasto.tagName).toBe("BUTTON");
    fireEvent.click(nuevoGasto);
    expect(await screen.findByRole("dialog", { name: "Nuevo gasto" })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("gasto-importe"), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(1));
    expect(crearGasto.mock.calls[0][0]).toMatchObject({
      cuentaId: cuenta.id,
      categoria: "ALQUILER",
      importe: 250,
      descripcion: null,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo gasto" })).not.toBeInTheDocument());
    expect(window.location.href).toBe(urlBefore);
    await waitFor(() => {
      expect(obtenerCuenta).toHaveBeenCalledWith(cuenta.id);
      expect(listarMovimientos).toHaveBeenCalledWith(cuenta.id, { limit: 50, offset: 0 });
    });
  });

  it("mantiene abierto el modal si falla el registro del gasto", async () => {
    crearGasto.mockResolvedValue({ data: null, error: "No se pudo registrar" });
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    fireEvent.click(await screen.findByTestId("cuenta-financiera-nuevo-gasto"));
    fireEvent.change(await screen.findByTestId("gasto-importe"), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    expect(await screen.findByTestId("modal-error")).toHaveTextContent("No se pudo registrar");
    expect(screen.getByRole("dialog", { name: "Nuevo gasto" })).toBeInTheDocument();
  });

  it("reutiliza la clave para el mismo payload y la renueva al editarlo", async () => {
    crearGasto
      .mockResolvedValueOnce({ data: null, error: "Respuesta ambigua" })
      .mockResolvedValueOnce({ data: null, error: "Respuesta ambigua" })
      .mockResolvedValueOnce({
        data: { id: "gasto-3", cuentaId: cuenta.id, categoria: "ALQUILER", importe: 300 },
        error: null,
      });
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    fireEvent.click(await screen.findByTestId("cuenta-financiera-nuevo-gasto"));
    fireEvent.change(await screen.findByTestId("gasto-importe"), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("modal-submit"));
    await screen.findByText("Respuesta ambigua");

    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(2));
    expect(crearGasto.mock.calls[1][0].idempotencyKey).toBe(crearGasto.mock.calls[0][0].idempotencyKey);

    fireEvent.change(screen.getByTestId("gasto-importe"), { target: { value: "300" } });
    fireEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(3));
    expect(crearGasto.mock.calls[2][0]).toMatchObject({ importe: 300 });
    expect(crearGasto.mock.calls[2][0].idempotencyKey).not.toBe(crearGasto.mock.calls[1][0].idempotencyKey);
  });

  it("cierra tras guardar aunque una recarga falle y avisa que la vista quedó desactualizada", async () => {
    crearGasto.mockResolvedValue({
      data: { id: "gasto-4", cuentaId: cuenta.id, categoria: "ALQUILER", importe: 250 },
      error: null,
    });
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    const nuevoGasto = await screen.findByTestId("cuenta-financiera-nuevo-gasto");
    listarCuentas.mockResolvedValue({ data: null, error: "No se pudo recargar cuentas" });
    fireEvent.click(nuevoGasto);
    fireEvent.change(await screen.findByTestId("gasto-importe"), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo gasto" })).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Gasto guardado, vista desactualizada",
      expect.stringContaining("No se pudo actualizar la lista de cuentas."),
    );
  });

  it("permite crear una cuenta desde el selector y registra allí el gasto", async () => {
    const nuevaCuenta = { ...cuenta, id: "33333333-3333-4333-8333-333333333333", nombre: "Cuenta nueva" };
    crearCuenta.mockResolvedValue({ data: nuevaCuenta, error: null });
    crearGasto.mockResolvedValue({
      data: { id: "gasto-2", cuentaId: nuevaCuenta.id, categoria: "ALQUILER", importe: 250 },
      error: null,
    });
    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    fireEvent.click(await screen.findByTestId("cuenta-financiera-nuevo-gasto"));
    fireEvent.click(screen.getByTestId("gasto-cuenta-financiera"));
    fireEvent.click(await screen.findByText("+ Crear cuenta"));
    fireEvent.change(await screen.findByTestId("gasto-cuenta-nombre"), { target: { value: "Cuenta nueva" } });
    fireEvent.change(screen.getByTestId("gasto-importe"), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(crearCuenta).toHaveBeenCalledWith({
      nombre: "Cuenta nueva",
      tipo: "EFECTIVO",
      saldoInicial: 0,
    }));
    await waitFor(() => expect(crearGasto).toHaveBeenCalledWith(expect.objectContaining({ cuentaId: nuevaCuenta.id })));
  });

  it("permite registrar un ingreso desde el detalle y actualiza saldo e historial", async () => {
    crearIngresoManual.mockResolvedValue({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        cuentaId: cuenta.id,
        importe: 250,
        fecha: "2026-09-24T12:00:00.000Z",
        descripcion: "Aporte",
        createdAt: "2026-09-24T12:00:00.000Z",
      },
      error: null,
    });

    render(
      <CuentasFinancierasProvider>
        <CuentaFinancieraDetailPage />
      </CuentasFinancierasProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Nuevo ingreso" }));
    expect(await screen.findByTestId("ingreso-manual-cuenta")).toHaveTextContent("Caja principal");
    fireEvent.change(screen.getByTestId("ingreso-manual-importe"), { target: { value: "250" } });
    fireEvent.change(screen.getByTestId("ingreso-manual-descripcion"), { target: { value: "Aporte" } });
    fireEvent.click(screen.getByTestId("modal-submit"));

    await waitFor(() => expect(crearIngresoManual).toHaveBeenCalledTimes(1));
    expect(crearIngresoManual.mock.calls[0][0]).toMatchObject({
      cuentaId: cuenta.id,
      importe: 250,
      descripcion: "Aporte",
    });
    await waitFor(() => {
      expect(obtenerCuenta).toHaveBeenCalledTimes(2);
      expect(listarMovimientos).toHaveBeenCalledTimes(2);
    });
  });
});
