import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operacion } from "@/model/types";

const getAllMock = vi.fn();
const getStatsMock = vi.fn();

vi.mock("@/clients/operacionesClient", () => ({
	OPERACIONES_PAGE_SIZE: 50,
	operacionesClient: {
		getAll: (...args: unknown[]) => getAllMock(...args),
		getStats: (...args: unknown[]) => getStatsMock(...args),
		getById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		anularPago: vi.fn(),
		revertirStock: vi.fn(),
	},
}));

import { OperacionesProvider, useOperaciones } from "./OperacionesProvider";

function makeOperacion(page: number): Operacion {
	return {
		id: `op-${page}`,
		tipo: "VENTA",
		taller_id: "taller-1",
		fecha: "2026-07-20T00:00:00.000Z",
		created_at: "2026-07-20T00:00:00.000Z",
		lineas: [],
	};
}

function OperationsProbe() {
	const { operaciones, hasMore, loadMore } = useOperaciones();

	return (
		<>
			<span data-testid="operaciones-ids">{operaciones.map((operacion) => operacion.id).join(",")}</span>
			{hasMore ? <button type="button" onClick={loadMore}>Cargar más</button> : null}
		</>
	);
}

describe("OperacionesProvider", () => {
	beforeEach(() => {
		getAllMock.mockReset();
		getStatsMock.mockReset();
		getAllMock.mockImplementation((_, options: { page?: number }) => {
			const page = options.page ?? 1;
			return Promise.resolve({
				data: [makeOperacion(page)],
				pagination: { page, pageSize: 50, total: 51 },
				error: null,
			});
		});
		getStatsMock.mockResolvedValue({ data: null, error: null });
	});

	it("acumula la siguiente página de 50 sin volver a pedir la primera", async () => {
		render(
			<OperacionesProvider>
				<OperationsProbe />
			</OperacionesProvider>
		);

		await waitFor(() => {
			expect(screen.getByTestId("operaciones-ids")).toHaveTextContent("op-1");
		});

		fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));

		await waitFor(() => {
			expect(screen.getByTestId("operaciones-ids")).toHaveTextContent("op-1,op-2");
		});

		expect(getAllMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
			expect.objectContaining({ page: 1 })
		);
		expect(getAllMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
			expect.objectContaining({ page: 2 })
		);
		expect(getStatsMock).toHaveBeenCalledWith(
			getAllMock.mock.calls[0][0],
			expect.anything(),
		);
	});

	it("expone anularPago y reenvía la llamada a operacionesClient", async () => {
		const { operacionesClient } = await import("@/clients/operacionesClient");
		vi.mocked(operacionesClient.anularPago).mockResolvedValue({
			data: makeOperacion(1),
			error: null,
		});

		let anularFn: ((id: string, pagoId: string) => Promise<Operacion | null>) | undefined;
		function AnularProbe() {
			const { anularPago } = useOperaciones();
			anularFn = anularPago;
			return null;
		}

		render(
			<OperacionesProvider>
				<AnularProbe />
			</OperacionesProvider>
		);

		await waitFor(() => expect(anularFn).toBeDefined());
		const result = await anularFn!("op-1", "pago-1");

		expect(operacionesClient.anularPago).toHaveBeenCalledWith("op-1", "pago-1");
		expect(result?.id).toBe("op-1");
	});

	it("expone revertirStock y reenvía la llamada a operacionesClient", async () => {
		const { operacionesClient } = await import("@/clients/operacionesClient");
		vi.mocked(operacionesClient.revertirStock).mockResolvedValue({
			data: makeOperacion(1),
			error: null,
		});

		let revertirFn: ((id: string, movId: string) => Promise<Operacion | null>) | undefined;
		function RevertirProbe() {
			const { revertirStock } = useOperaciones();
			revertirFn = revertirStock;
			return null;
		}

		render(
			<OperacionesProvider>
				<RevertirProbe />
			</OperacionesProvider>
		);

		await waitFor(() => expect(revertirFn).toBeDefined());
		const result = await revertirFn!("op-1", "mov-1");

		expect(operacionesClient.revertirStock).toHaveBeenCalledWith("op-1", "mov-1");
		expect(result?.id).toBe("op-1");
	});
});

