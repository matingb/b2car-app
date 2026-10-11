import { safeNumber } from "@/lib/numbers";

/**
 * Importe que paga el cliente por una línea del arreglo. Replica `importe_comercial_arreglo`
 * en la base: si los precios se cargaron sin IVA, redondea la línea y le suma su IVA redondeado.
 */
export function importeComercial(
	importe: number,
	preciosIncluyenIva: boolean,
	tasaIva: number
): number {
	if (preciosIncluyenIva) return importe;
	const neto = roundCurrency(importe);
	return neto + roundCurrency(neto * safeNumber(tasaIva));
}

function roundCurrency(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
