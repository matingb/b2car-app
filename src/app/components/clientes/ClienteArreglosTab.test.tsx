import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClienteArreglosTab from "./ClienteArreglosTab";
import { createArreglo } from "@/tests/factories";

const mockGetAll = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/clients/arreglosClient", () => ({
  arreglosClient: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));

vi.mock("@/app/providers/TenantProvider", () => ({
  useTenant: () => ({
    talleres: [{ id: "t1", nombre: "Taller Principal" }],
    tallerSeleccionadoId: "t1",
  }),
}));

vi.mock("@/app/providers/CategoriasArregloProvider", () => ({
  useCategoriasArreglo: () => ({
    categorias: [],
  }),
}));

vi.mock("@/app/providers/EmpleadosProvider", () => ({
  useEmpleados: () => ({
    empleados: [],
  }),
  getEmpleadoColor: () => ({
    bg: "#eef2ff",
    text: "#4338ca",
    border: "#e0e7ff",
    avatarBg: "#c7d2fe",
    avatarText: "#312e81",
  }),
}));

vi.mock("@/app/providers/ArreglosProvider", () => ({
  useArreglos: () => ({
    update: vi.fn(),
  }),
}));

vi.mock("@/app/providers/ModalMessageProvider", () => ({
  useModalMessage: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock("@/app/providers/CuentasFinancierasProvider", () => ({
  useCuentasFinancieras: () => ({
    cuentas: [],
    cuentasActivas: [],
    loading: false,
  }),
}));

vi.mock("@/app/providers/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ClienteArreglosTab", () => {
  it("renderiza los arreglos usando el card ArregloItem con el nuevo footer", async () => {
    mockGetAll.mockResolvedValueOnce({
      data: [
        createArreglo({
          id: "arr-1",
          descripcion: "Mano de obra | Revisión",
          precio_final: 700000,
          esta_pago: true,
          total_cobrado: 700000,
          saldo_pendiente: 0,
          estado: "SIN_INICIAR",
          factura_electronica: {
            id: "f-1",
            estado: "AUTORIZADA",
            clase_comprobante: "FC B",
            punto_venta: 1,
            numero_comprobante: 4511,
          },
        }),
        createArreglo({
          id: "arr-2",
          descripcion: "Cambio pastillas de freno | Alineación y balanceo",
          precio_final: 40000,
          esta_pago: false,
          total_cobrado: 0,
          saldo_pendiente: 40000,
          estado: "TERMINADO",
          es_facturable: true,
        }),
      ],
      error: null,
    });

    render(<ClienteArreglosTab clienteId="cli-1" />);

    await waitFor(() => {
      expect(screen.getByText("Mano de obra | Revisión")).toBeInTheDocument();
      expect(screen.getByText("Cambio pastillas de freno | Alineación y balanceo")).toBeInTheDocument();
    });

    // Validar elementos del nuevo footer de los cards
    expect(screen.getByText("Factura emitida (FC B-0001-00004511)")).toBeInTheDocument();
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de facturación")).toBeInTheDocument();
    expect(screen.getByText("Pendiente ($40.000)")).toBeInTheDocument();
  });
});
