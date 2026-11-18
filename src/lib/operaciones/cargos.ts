import { MAX_LINEAS_COMPROBANTE, PERCEPCIONES_SUGERIDAS } from "@/lib/comprobantesRecibidos/types";

export type OperacionCargoInput = {
	tipo?: "PERCEPCION";
	percepcion_codigo: string;
	descripcion: string;
	importe: number;
};

const CODIGOS_PERCEPCION = new Set<string>([...PERCEPCIONES_SUGERIDAS.map((p) => p.codigo), "OTRA"]);

export function validarCargos(cargos: unknown[]): string | null {
	if (cargos.length > MAX_LINEAS_COMPROBANTE) return `La compra admite hasta ${MAX_LINEAS_COMPROBANTE} percepciones`;
	for (const [index, raw] of cargos.entries()) {
		const n = index + 1;
		const cargo = raw as Partial<OperacionCargoInput> | null;
		if (!cargo || typeof cargo !== "object") return `Percepción ${n}: formato inválido`;
		if (cargo.tipo !== undefined && cargo.tipo !== "PERCEPCION") return `Percepción ${n}: tipo no admitido`;
		if (typeof cargo.percepcion_codigo !== "string" || !CODIGOS_PERCEPCION.has(cargo.percepcion_codigo)) {
			return `Percepción ${n}: la percepción no es válida`;
		}
		const descripcion = typeof cargo.descripcion === "string" ? cargo.descripcion.trim() : "";
		if (!descripcion || descripcion.length > 200) return `Percepción ${n}: la descripción es obligatoria (hasta 200 caracteres)`;
		const importe = cargo.importe;
		if (typeof importe !== "number" || !Number.isFinite(importe) || importe <= 0 || Math.round(importe * 100) / 100 !== importe) {
			return `Percepción ${n}: el importe debe ser mayor a 0 y tener hasta 2 decimales`;
		}
	}
	return null;
}
