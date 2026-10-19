import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArreglo, createVehiculo } from "@/tests/factories";

const getAllMock = vi.fn();
const cobrarMock = vi.fn();
const anularCobroMock = vi.fn();

vi.mock("@/clients/arreglosClient", () => ({
  arreglosClient: {
    getAll: (...args: unknown[]) => getAllMock(...args),
    cobrar: (...args: unknown[]) => cobrarMock(...args),
    anularCobro: (...args: unknown[]) => anularCobroMock(...args),
  },
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({ tallerSeleccionadoId: "t1" }),
}));

import { ArreglosProvider, useArreglos } from "./ArreglosProvider";

let api: ReturnType<typeof useArreglos>;

function Probe() {
  api = useArreglos();
  return (
    <ul data-testid="arreglos">
      {api.arreglos.map((a) => (
        <li key={a.id}>{`${a.id}:${a.esta_pago ? "pago" : "pendiente"}:${a.total_cobrado ?? 0}`}</li>
      ))}
    </ul>
  );
}

const filtrosActivos = { tallerId: "t1", limit: 50, search: "aceite", estadoPago: "PENDIENTE" };

async function renderConListadoCargado() {
  const vehiculo = createVehiculo({ nombre_cliente: "Cliente Uno" });
  getAllMock.mockResolvedValue({
    data: [
      createArreglo({ id: "arr-1", vehiculo, esta_pago: false, total_cobrado: 0, saldo_pendiente: 1000 }),
      createArreglo({ id: "arr-2", vehiculo, esta_pago: false, total_cobrado: 0, saldo_pendiente: 2000 }),
    ],
    page: { hasMore: false },
    error: null,
  });

  render(
    <ArreglosProvider>
      <Probe />
    </ArreglosProvider>
  );
  await act(async () => {
    await api.fetchAll(filtrosActivos);
  });
  await waitFor(() => expect(screen.getByTestId("arreglos")).toHaveTextContent("arr-1:pendiente:0"));
  getAllMock.mockClear();
}

describe("ArreglosProvider cobros", () => {
  beforeEach(() => {
    getAllMock.mockReset();
    cobrarMock.mockReset();
    anularCobroMock.mockReset();
  });

  it("al cobrar actualiza la fila del listado sin volver a pedirlo con otros filtros", async () => {
    await renderConListadoCargado();
    cobrarMock.mockResolvedValue({
      data: createArreglo({
        id: "arr-1",
        vehiculo: createVehiculo({ nombre_cliente: undefined }),
        esta_pago: true,
        total_cobrado: 1000,
        saldo_pendiente: 0,
      }),
      error: null,
    });

    await act(async () => {
      await api.cobrar("arr-1", { cuenta_financiera_id: "cta-1", fecha_cobro: "2026-10-12" });
    });

    const items = screen.getByTestId("arreglos");
    expect(items).toHaveTextContent("arr-1:pago:1000");
    expect(items).toHaveTextContent("arr-2:pendiente:0");
    expect(api.arreglos[0].vehiculo.nombre_cliente).toBe("Cliente Uno");
    expect(getAllMock).not.toHaveBeenCalled();
  });

  it("al anular un cobro actualiza la fila del listado", async () => {
    await renderConListadoCargado();
    cobrarMock.mockResolvedValue({
      data: createArreglo({ id: "arr-2", esta_pago: true, total_cobrado: 2000, saldo_pendiente: 0 }),
      error: null,
    });
    await act(async () => {
      await api.cobrar("arr-2", { cuenta_financiera_id: "cta-1", fecha_cobro: "2026-10-12" });
    });
    expect(screen.getByTestId("arreglos")).toHaveTextContent("arr-2:pago:2000");

    anularCobroMock.mockResolvedValue({
      data: createArreglo({ id: "arr-2", esta_pago: false, total_cobrado: 0, saldo_pendiente: 2000 }),
      error: null,
    });
    await act(async () => {
      await api.anularCobro("arr-2");
    });

    expect(screen.getByTestId("arreglos")).toHaveTextContent("arr-2:pendiente:0");
    expect(getAllMock).not.toHaveBeenCalled();
  });

  it("si el cobro falla no modifica el listado", async () => {
    await renderConListadoCargado();
    cobrarMock.mockResolvedValue({ data: null, error: "Sin saldo" });

    await act(async () => {
      await expect(
        api.cobrar("arr-1", { cuenta_financiera_id: "cta-1", fecha_cobro: "2026-10-12" })
      ).rejects.toThrow("Sin saldo");
    });

    expect(screen.getByTestId("arreglos")).toHaveTextContent("arr-1:pendiente:0");
  });
});
