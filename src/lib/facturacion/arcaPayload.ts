import {
  ALICUOTAS_IVA_ARCA,
  type CondicionIvaEmisor,
  type DocumentoFiscalClase,
  type DocumentoFiscalTipo,
  type FacturaClase,
  type FacturaConcepto,
  type FacturaFechaInput,
  type FacturaLinea,
  type FacturaTotales,
  type PerfilFiscalCliente,
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
  if (!Number.isSafeInteger(cents)) throw new FacturacionValidationError("El importe en centavos no es válido");
  return cents / 100;
}

export function normalizeDocumentNumber(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCuitCuil(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return Number(value[10]) === expected;
}

export function validateDocument(
  tipoDocumento: DocumentoFiscalTipo | null | undefined,
  numeroDocumento: string | number | null | undefined,
): { tipoDocumento: DocumentoFiscalTipo; numeroDocumento: string } {
  if (tipoDocumento === 99) return { tipoDocumento: 99, numeroDocumento: "0" };
  if (tipoDocumento !== 80 && tipoDocumento !== 86 && tipoDocumento !== 96) {
    throw new FacturacionValidationError("El tipo de documento del receptor no es válido");
  }
  const normalized = normalizeDocumentNumber(numeroDocumento);
  if (!normalized) throw new FacturacionValidationError("El documento del receptor es obligatorio");
  const valid = tipoDocumento === 96
    ? normalized.length >= 7 && normalized.length <= 8
    : isValidCuitCuil(normalized);
  if (!valid) {
    throw new FacturacionValidationError(
      tipoDocumento === 96 ? "El DNI debe tener entre 7 y 8 dígitos" : "El CUIT o CUIL no es válido",
    );
  }
  return { tipoDocumento, numeroDocumento: normalized };
}

export function deriveFacturaConcepto(lineas: FacturaLinea[]): FacturaConcepto {
  const servicios = lineas.some((linea) => linea.origen === "SERVICIO" || linea.origen === "FORMULARIO");
  const productos = lineas.some((linea) => linea.origen === "REPUESTO" || linea.origen === "VENTA");
  if (servicios && productos) return 3;
  if (servicios) return 2;
  if (productos || lineas.every((linea) => linea.origen === "AJUSTE")) return 1;
  throw new FacturacionValidationError("El origen no tiene líneas facturables");
}

export function determineVoucher(
  condicionEmisor: CondicionIvaEmisor,
  condicionReceptor: PerfilFiscalCliente["condicionIvaReceptorId"],
  documentoTipo: DocumentoFiscalClase = "FACTURA",
): { clase: FacturaClase; tipo: number } {
  if (!condicionReceptor) throw new FacturacionValidationError("La condición IVA del receptor es obligatoria");
  const receptorRecibeA = [1, 6, 13, 16].includes(condicionReceptor);
  const clase: FacturaClase = condicionEmisor === "MONOTRIBUTISTA"
    ? "C"
    : receptorRecibeA ? "A" : "B";
  const tipos = {
    A: { FACTURA: 1, NOTA_DEBITO: 2, NOTA_CREDITO: 3 },
    B: { FACTURA: 6, NOTA_DEBITO: 7, NOTA_CREDITO: 8 },
    C: { FACTURA: 11, NOTA_DEBITO: 12, NOTA_CREDITO: 13 },
    M: { FACTURA: 51, NOTA_DEBITO: 52, NOTA_CREDITO: 53 },
  } as const;
  return { clase, tipo: tipos[clase][documentoTipo] };
}

export function fiscalizeLineas(
  lineas: FacturaLinea[],
  condicionEmisor: CondicionIvaEmisor,
): { lineas: FacturaLinea[]; totales: FacturaTotales } {
  if (!lineas.length) throw new FacturacionValidationError("El origen no tiene líneas facturables");
  let neto = 0;
  let noGravado = 0;
  let exento = 0;
  let iva = 0;
  let total = 0;
  const result = lineas.map((source) => {
    if (!source.descripcion.trim()) throw new FacturacionValidationError("Todas las líneas deben tener descripción");
    if (!Number.isFinite(source.cantidad) || source.cantidad <= 0) {
      throw new FacturacionValidationError("La cantidad de una línea no es válida");
    }
    const subtotal = amountToCents(source.subtotal);
    const unitario = amountToCents(source.importeUnitario);
    if (Math.round(source.cantidad * unitario) !== subtotal) {
      throw new FacturacionValidationError("El subtotal no coincide con cantidad por precio unitario");
    }
    const tratamiento = source.tratamientoIva ?? "GRAVADO";
    let alicuotaId: number | null = source.ivaAlicuotaId ?? 5;
    let porcentaje = ALICUOTAS_IVA_ARCA.find((item) => item.id === alicuotaId)?.porcentaje;
    if (tratamiento !== "GRAVADO") {
      alicuotaId = null;
      porcentaje = 0;
    }
    if (porcentaje == null) throw new FacturacionValidationError("La alícuota IVA no es válida");
    let importeNeto = subtotal;
    let importeIva = 0;
    if (condicionEmisor === "RESPONSABLE_INSCRIPTO" && tratamiento === "GRAVADO") {
      importeNeto = Math.round((subtotal * 10000) / (10000 + Math.round(porcentaje * 100)));
      importeIva = subtotal - importeNeto;
      neto += importeNeto;
      iva += importeIva;
    } else if (tratamiento === "EXENTO") {
      exento += subtotal;
    } else if (tratamiento === "NO_GRAVADO") {
      noGravado += subtotal;
    } else {
      neto += subtotal;
      if (condicionEmisor === "MONOTRIBUTISTA") {
        alicuotaId = null;
        porcentaje = 0;
      }
    }
    total += subtotal;
    return {
      ...source,
      tratamientoIva: tratamiento,
      ivaAlicuotaId: alicuotaId,
      ivaAlicuota: porcentaje,
      importeNeto: centsToAmount(importeNeto),
      importeIva: centsToAmount(importeIva),
      importeTotal: centsToAmount(subtotal),
    };
  });
  return {
    lineas: result,
    totales: {
      netoGravado: centsToAmount(neto), noGravado: centsToAmount(noGravado),
      exento: centsToAmount(exento), iva: centsToAmount(iva), tributos: 0,
      otrosImpuestosNacionales: 0, total: centsToAmount(total),
    },
  };
}

export function validateLineasYTotal(lineas: FacturaLinea[], total: number): number {
  const cents = lineas.reduce((sum, linea) => sum + amountToCents(linea.subtotal), 0);
  if (cents <= 0) throw new FacturacionValidationError("El total fiscal debe ser positivo");
  if (cents !== amountToCents(total)) {
    throw new FacturacionValidationError("El total de las líneas no coincide con el total del origen");
  }
  return cents;
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

function distance(a: Date, b: Date) { return Math.round((a.getTime() - b.getTime()) / 86_400_000); }
function arcaDate(value: string) { return value.replaceAll("-", ""); }

export function validateFechas(
  concepto: FacturaConcepto,
  fechas: FacturaFechaInput,
  today = new Date(),
): Required<FacturaFechaInput> {
  const comprobante = parseIsoDate(fechas.fechaComprobante, "La fecha de comprobante");
  const hoy = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const maxDays = concepto === 1 ? 5 : 10;
  if (Math.abs(distance(comprobante, hoy)) > maxDays) {
    throw new FacturacionValidationError(`La fecha debe estar dentro de los ${maxDays} días de hoy`);
  }
  if (concepto === 1 && (comprobante.getUTCFullYear() !== hoy.getUTCFullYear()
      || comprobante.getUTCMonth() !== hoy.getUTCMonth())) {
    throw new FacturacionValidationError("Los comprobantes de productos deben pertenecer al mes actual");
  }
  if (concepto === 1) return { fechaComprobante: fechas.fechaComprobante, fechaServicioDesde: "", fechaServicioHasta: "", fechaVencimientoPago: "" };
  const desde = parseIsoDate(fechas.fechaServicioDesde, "La fecha de servicio desde");
  const hasta = parseIsoDate(fechas.fechaServicioHasta, "La fecha de servicio hasta");
  const vencimiento = parseIsoDate(fechas.fechaVencimientoPago, "La fecha de vencimiento de pago");
  if (desde > hasta) throw new FacturacionValidationError("La fecha desde no puede ser posterior a la fecha hasta");
  if (vencimiento < comprobante) throw new FacturacionValidationError("El vencimiento no puede ser anterior al comprobante");
  return { fechaComprobante: fechas.fechaComprobante, fechaServicioDesde: fechas.fechaServicioDesde!, fechaServicioHasta: fechas.fechaServicioHasta!, fechaVencimientoPago: fechas.fechaVencimientoPago! };
}

export type ComprobanteAsociado = { tipo: number; puntoVenta: number; numero: number };

export function buildComprobantePayload(input: {
  voucherNumber: number;
  puntoVenta: number;
  tipoComprobante: number;
  claseComprobante: FacturaClase;
  concepto: FacturaConcepto;
  receptor: PerfilFiscalCliente;
  fechas: FacturaFechaInput;
  totales: FacturaTotales;
  lineas: FacturaLinea[];
  asociado?: ComprobanteAsociado | null;
}): Record<string, unknown> {
  if (!Number.isInteger(input.voucherNumber) || input.voucherNumber <= 0) throw new FacturacionValidationError("Número candidato inválido");
  if (!Number.isInteger(input.puntoVenta) || input.puntoVenta <= 0) throw new FacturacionValidationError("Punto de venta inválido");
  const doc = validateDocument(input.receptor.tipoDocumento, input.receptor.numeroDocumento);
  if (!input.receptor.condicionIvaReceptorId) throw new FacturacionValidationError("La condición IVA es obligatoria");
  if ((input.claseComprobante === "A" || input.claseComprobante === "M") && doc.tipoDocumento !== 80) {
    throw new FacturacionValidationError("Los comprobantes A o M requieren CUIT del receptor");
  }
  if (doc.tipoDocumento === 99 && input.receptor.condicionIvaReceptorId !== 5) {
    throw new FacturacionValidationError("El documento 99 sólo corresponde a consumidor final");
  }
  const fechas = validateFechas(input.concepto, input.fechas);
  const payload: Record<string, unknown> = {
    CantReg: 1, PtoVta: input.puntoVenta, CbteTipo: input.tipoComprobante,
    Concepto: input.concepto, DocTipo: doc.tipoDocumento, DocNro: Number(doc.numeroDocumento),
    CbteDesde: input.voucherNumber, CbteHasta: input.voucherNumber,
    CbteFch: arcaDate(fechas.fechaComprobante), ImpTotal: input.totales.total,
    ImpTotConc: input.totales.noGravado, ImpNeto: input.totales.netoGravado,
    ImpOpEx: input.totales.exento, ImpTrib: input.totales.tributos,
    ImpIVA: input.totales.iva, MonId: "PES", MonCotiz: 1,
    CondicionIVAReceptorId: input.receptor.condicionIvaReceptorId,
  };
  if (input.concepto !== 1) {
    payload.FchServDesde = arcaDate(fechas.fechaServicioDesde!);
    payload.FchServHasta = arcaDate(fechas.fechaServicioHasta!);
    payload.FchVtoPago = arcaDate(fechas.fechaVencimientoPago!);
  }
  if (input.claseComprobante !== "C") {
    const grouped = new Map<number, { BaseImp: number; Importe: number }>();
    input.lineas.forEach((line) => {
      if (line.tratamientoIva !== "GRAVADO" || !line.ivaAlicuotaId) return;
      const current = grouped.get(line.ivaAlicuotaId) ?? { BaseImp: 0, Importe: 0 };
      current.BaseImp += line.importeNeto ?? 0;
      current.Importe += line.importeIva ?? 0;
      grouped.set(line.ivaAlicuotaId, current);
    });
    const iva = Array.from(grouped, ([Id, values]) => ({
      Id, BaseImp: Number(values.BaseImp.toFixed(2)), Importe: Number(values.Importe.toFixed(2)),
    }));
    if (iva.length) payload.Iva = iva;
  }
  if (input.asociado) payload.CbtesAsoc = [{ Tipo: input.asociado.tipo, PtoVta: input.asociado.puntoVenta, Nro: input.asociado.numero }];
  return payload;
}

export function buildFacturaCPayload(input: {
  voucherNumber: number; puntoVenta: number; concepto: FacturaConcepto;
  receptor: PerfilFiscalCliente; fechas: FacturaFechaInput; totalCentavos: number;
}): Record<string, unknown> {
  const total = centsToAmount(input.totalCentavos);
  return buildComprobantePayload({
    ...input, tipoComprobante: 11, claseComprobante: "C", lineas: [],
    totales: { netoGravado: total, noGravado: 0, exento: 0, iva: 0, tributos: 0, otrosImpuestosNacionales: 0, total },
  });
}

export function toIsoDate(value: Date): string { return value.toISOString().slice(0, 10); }
