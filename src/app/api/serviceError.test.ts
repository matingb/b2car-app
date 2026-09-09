import { describe, it, expect } from "vitest";
import { ServiceError, toServiceError } from "./serviceError";
import type { PostgrestError } from "@supabase/supabase-js";

describe("serviceError", () => {
	it("mapea 55000 a MovimientoFinancieroInmutable", () => {
		const err: PostgrestError = {
			code: "55000",
			message: "Los movimientos financieros registrados no se pueden modificar ni eliminar.",
			details: "",
			hint: "",
		};
		expect(toServiceError(err)).toBe(ServiceError.MovimientoFinancieroInmutable);
	});

	it("mapea 55001 a ArregloFacturado", () => {
		const err: PostgrestError = {
			code: "55001",
			message: "El arreglo ya posee una factura electronica autorizada",
			details: "",
			hint: "",
		};
		expect(toServiceError(err)).toBe(ServiceError.ArregloFacturado);
	});

	it("mapea PGRST116 y P0002 a NotFound", () => {
		expect(toServiceError({ code: "PGRST116" } as PostgrestError)).toBe(ServiceError.NotFound);
		expect(toServiceError({ code: "P0002" } as PostgrestError)).toBe(ServiceError.NotFound);
	});

	it("mapea 23505 a Conflict", () => {
		expect(toServiceError({ code: "23505" } as PostgrestError)).toBe(ServiceError.Conflict);
	});

	it("mapea P0001 a StockInsuficiente", () => {
		expect(toServiceError({ code: "P0001" } as PostgrestError)).toBe(ServiceError.StockInsuficiente);
	});

	it("mapea códigos desconocidos a Unknown", () => {
		expect(toServiceError({ code: "XYZ999" } as PostgrestError)).toBe(ServiceError.Unknown);
	});
});
