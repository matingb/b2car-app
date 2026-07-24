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
	});
});
