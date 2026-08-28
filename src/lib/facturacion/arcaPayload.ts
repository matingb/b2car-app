import type {
  DocumentoFiscalTipo,
  FacturaConcepto,
  FacturaFechaInput,
  FacturaLinea,
  PerfilFiscalCliente,
} from "./types";

export class FacturacionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacturacionValidationError";
  }
}

export function amountToCents(value: number | string | null | undefined): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
    throw new FacturacionValidationError("El importe debe ser un número válido");
  }
  const cents = Math.round((numeric + Number.EPSILON) * 100);
  if (Math.abs(numeric * 100 - cents) > 0.000001) {
    throw new FacturacionValidationError("Los importes fiscales sólo admiten dos decimales");
  }
  return cents;
}

export function centsToAmount(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new FacturacionValidationError("El importe en centavos no es válido");
  }
  return cents / 100;
}

export function normalizeDocumentNumber(value: string | number | null | undefined): string {
  const normalized = String(value ?? "").replace(/\D/g, "");
  if (!normalized) throw new FacturacionValidationError("El documento del receptor es obligatorio");
  return normalized;
}

export function validateDocument(
  tipoDocumento: DocumentoFiscalTipo | null | undefined,
  numeroDocumento: string | number | null | undefined,
): { tipoDocumento: DocumentoFiscalTipo; numeroDocumento: string } {
  if (tipoDocumento !== 80 && tipoDocumento !== 86 && tipoDocumento !== 96) {
    throw new FacturacionValidationError("El tipo de documento del receptor no es válido");
  }
  const normalized = normalizeDocumentNumber(numeroDocumento);
  const isDni = tipoDocumento === 96;
  const expectedLength = isDni ? normalized.length >= 7 && normalized.length <= 8 : normalized.length === 11;
  if (!expectedLength) {
    throw new FacturacionValidationError(
      isDni ? "El DNI debe tener entre 7 y 8 dígitos" : "El CUIT o CUIL debe tener 11 dígitos",
    );
  }
  return { tipoDocumento, numeroDocumento: normalized };
}

export function deriveFacturaConcepto(lineas: FacturaLinea[]): FacturaConcepto {
  const hasServicios = lineas.some((linea) => linea.origen === "SERVICIO" || linea.origen === "FORMULARIO");
  const hasRepuestos = lineas.some((linea) => linea.origen === "REPUESTO");
  if (hasServicios && hasRepuestos) return 3;
  if (hasServicios) return 2;
  if (hasRepuestos) return 1;
  throw new FacturacionValidationError("El arreglo no tiene líneas facturables");
}

export function validateLineasYTotal(lineas: FacturaLinea[], precioFinal: number): number {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new FacturacionValidationError("El arreglo no tiene líneas facturables");
  }
  const totalCentavos = lineas.reduce((acc, linea) => {
    if (!linea.descripcion.trim()) {
      throw new FacturacionValidationError("Todas las líneas fiscales deben tener descripción");
    }
    if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) {
      throw new FacturacionValidationError("La cantidad de una línea fiscal no es válida");
    }
    const subtotal = amountToCents(linea.subtotal);
    const unitario = amountToCents(linea.importeUnitario);
    const calculated = Math.round(linea.cantidad * unitario);
    if (calculated !== subtotal) {
      throw new FacturacionValidationError("El subtotal de una línea fiscal no coincide con cantidad por precio unitario");
    }
    return acc + subtotal;
  }, 0);
  const precioFinalCentavos = amountToCents(precioFinal);
  if (totalCentavos <= 0) throw new FacturacionValidationError("El total fiscal debe ser positivo");
  if (totalCentavos !== precioFinalCentavos) {
    throw new FacturacionValidationError(
      "El total de las líneas no coincide exactamente con el precio final del arreglo",
    );
  }
  return totalCentavos;
}

function parseIsoDate(value: string | null | undefined, label: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FacturacionValidationError(`${label} es obligatoria y debe tener formato AAAA-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new FacturacionValidationError(`${label} no es una fecha válida`);
  }
  return parsed;
}

function dateToArca(value: string): string {
  return value.replaceAll("-", "");
}

function dayDistance(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function validateFechas(
  concepto: FacturaConcepto,
  fechas: FacturaFechaInput,
  today = new Date(),
): Required<FacturaFechaInput> {
  const fechaComprobante = parseIsoDate(fechas.fechaComprobante, "La fecha de comprobante");
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (Math.abs(dayDistance(fechaComprobante, todayUtc)) > 10) {
    throw new FacturacionValidationError("La fecha de comprobante debe estar dentro de los 10 días de hoy");
  }

  if (concepto === 1) {
    return {
      fechaComprobante: fechas.fechaComprobante,
      fechaServicioDesde: "",
      fechaServicioHasta: "",
      fechaVencimientoPago: "",
    };
  }

  const fechaServicioDesde = parseIsoDate(fechas.fechaServicioDesde, "La fecha de servicio desde");
  const fechaServicioHasta = parseIsoDate(fechas.fechaServicioHasta, "La fecha de servicio hasta");
  const fechaVencimientoPago = parseIsoDate(fechas.fechaVencimientoPago, "La fecha de vencimiento de pago");
  if (fechaServicioDesde > fechaServicioHasta) {
    throw new FacturacionValidationError("La fecha de servicio desde no puede ser posterior a la fecha hasta");
  }
  if (fechaVencimientoPago < fechaServicioHasta) {
    throw new FacturacionValidationError("El vencimiento de pago no puede ser anterior al fin del servicio");
  }
  return {
    fechaComprobante: fechas.fechaComprobante,
    fechaServicioDesde: fechas.fechaServicioDesde!,
    fechaServicioHasta: fechas.fechaServicioHasta!,
    fechaVencimientoPago: fechas.fechaVencimientoPago!,
  };
}

export function buildFacturaCPayload(input: {
  voucherNumber: number;
  puntoVenta: number;
  concepto: FacturaConcepto;
  receptor: PerfilFiscalCliente;
  fechas: FacturaFechaInput;
  totalCentavos: number;
}): Record<string, number | string> {
  if (!Number.isInteger(input.voucherNumber) || input.voucherNumber <= 0) {
    throw new FacturacionValidationError("El número de comprobante candidato no es válido");
  }
  if (!Number.isInteger(input.puntoVenta) || input.puntoVenta <= 0) {
    throw new FacturacionValidationError("El punto de venta no es válido");
  }
  const document = validateDocument(input.receptor.tipoDocumento, input.receptor.numeroDocumento);
  if (!input.receptor.condicionIvaReceptorId) {
    throw new FacturacionValidationError("La condición IVA del receptor es obligatoria");
  }
  const fechas = validateFechas(input.concepto, input.fechas);
  const total = centsToAmount(input.totalCentavos);
  const payload: Record<string, number | string> = {
    CantReg: 1,
    PtoVta: input.puntoVenta,
    CbteTipo: 11,
    Concepto: input.concepto,
    DocTipo: document.tipoDocumento,
    DocNro: Number(document.numeroDocumento),
    CbteDesde: input.voucherNumber,
    CbteHasta: input.voucherNumber,
    CbteFch: dateToArca(fechas.fechaComprobante),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpTrib: 0,
    ImpIVA: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: input.receptor.condicionIvaReceptorId,
  };
  if (input.concepto === 2 || input.concepto === 3) {
    payload.FchServDesde = dateToArca(fechas.fechaServicioDesde!);
    payload.FchServHasta = dateToArca(fechas.fechaServicioHasta!);
    payload.FchVtoPago = dateToArca(fechas.fechaVencimientoPago!);
  }
  return payload;
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
