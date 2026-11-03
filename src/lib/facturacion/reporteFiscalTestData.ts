import type { FiscalHeader, FiscalLine } from "@/app/api/facturas/export/facturasReporteRepository";
import type { FiscalScope } from "./reporteFiscal";

/** Entirely synthetic identities, shared by fiscal tests and artifact verification. */
export const fiscalTestFilters: FiscalScope = { format: "csv", desde: "2026-10-01", hasta: "2026-10-31", ambiente: "PRODUCCION" };
export const fiscalTestCorte = "2026-11-02T18:00:00.000Z";
export const fiscalTestId = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
export function fiscalTestHeader(overrides: Partial<FiscalHeader> = {}): FiscalHeader {
  return {
    id: fiscalTestId(1), tenant_id: "tenant-a", fecha_comprobante: "2026-10-31", autorizada_at: "2026-11-01T00:00:00Z", created_at: "2026-10-31T00:00:00Z",
    documento_tipo: "FACTURA", clase_comprobante: "A", tipo_comprobante: 1, punto_venta: 5, numero_comprobante: 103,
    cae: "00001234567890", cae_vencimiento: "2026-11-10", emisor_snapshot: { cuit: "20111111112", razonSocial: "Emisor ficticio" },
    receptor_snapshot: { nombre: "Receptor ficticio", tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5 },
    moneda: "PES", origen_tipo: "ARREGLO", arreglo_id: "arreglo-ficticio", operacion_id: null, documento_asociado_id: null,
    importe_neto_gravado: "100.00", importe_exento: 0, importe_no_gravado: 0, importe_iva: "21.00", importe_tributos: 0, otros_impuestos_nacionales: 0, total: "121.00",
    ...overrides,
  };
}
export function fiscalTestLine(overrides: Partial<FiscalLine> = {}): FiscalLine {
  return { id: fiscalTestId(10000), factura_id: fiscalTestId(1), tratamiento_iva: "GRAVADO", iva_alicuota_id: 5, iva_alicuota: 21,
    importe_neto: 100, importe_iva: 21, importe_total: 121, snapshot: {}, ...overrides };
}
