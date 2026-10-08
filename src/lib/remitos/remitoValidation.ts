import { isValidCuitCuil, normalizeDocumentNumber } from "@/lib/facturacion/arcaPayload";
import { CONDICIONES_IVA_RECEPTOR, type CondicionIvaReceptorId } from "@/lib/facturacion/types";
import { parseCalendarDate, toISODateAppTimeZone } from "@/lib/fechas";
import { isValidUuid } from "@/lib/uuid";
import {
  REMITO_MAX_LINEAS,
  REMITO_NUMERO_MAXIMO,
  REMITO_PUNTO_EMISION_MAXIMO,
  formatRemitoNumero,
  type AsociarFacturaInput,
  type EmitirRemitoInput,
  type EmitirRemitoLineaInput,
  type EvaluacionEmisor,
  type EvaluacionTipo,
  type RemitoDestinatario,
  type RemitoDocumentoTipo,
  type RemitoFacturaLineaDisponible,
  type RemitoRConfiguracion,
  type RemitoTransportista,
  type RemitosConfiguracionInput,
} from "./types";

export type Validated<T> = { value?: T; error?: string };

type Raw = Record<string, unknown>;

class RemitoInputError extends Error {}

function fail(message: string): never {
  throw new RemitoInputError(message);
}

function validated<T>(build: () => T): Validated<T> {
  try {
    return { value: build() };
  } catch (error) {
    if (error instanceof RemitoInputError) return { error: error.message };
    throw error;
  }
}

function record(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : null;
}

/** Texto recortado; vacío o ausente se normaliza a `null`. */
function optionalText(value: unknown, label: string, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") fail(`${label} no es válido`);
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) fail(`${label} no puede superar los ${max} caracteres`);
  return text;
}

function optionalDate(value: unknown, label: string): string | null {
  const text = optionalText(value, label, 10);
  if (text && !parseCalendarDate(text)) fail(`${label} debe ser una fecha válida`);
  return text;
}

function optionalInteger(value: unknown, label: string, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`${label} debe ser un número entero entre ${min} y ${max}`);
  }
  return parsed;
}

function requiredInteger(value: unknown, label: string, min: number, max: number): number {
  const parsed = optionalInteger(value, label, min, max);
  if (parsed === null) fail(`${label} es obligatorio`);
  return parsed;
}

function optionalUuid(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (!isValidUuid(value)) fail(`${label} no es válido`);
  return value;
}

function optionalCuit(value: unknown, label: string): string | null {
  const text = optionalText(value, label, 20);
  if (!text) return null;
  const cuit = normalizeDocumentNumber(text);
  if (!isValidCuitCuil(cuit)) fail(`${label} no es un CUIT válido`);
  return cuit;
}

/** Cantidad positiva, finita y con hasta 4 decimales (numeric(14,4) en la base). */
export function isCantidadValida(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1e10) return false;
  const scaled = value * 10_000;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

function parseCantidad(value: unknown, ordinal: number): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (!isCantidadValida(parsed)) {
    fail(`La cantidad del ítem ${ordinal} debe ser mayor a cero y tener hasta 4 decimales`);
  }
  // Evita arrastrar errores de punto flotante (0.30000000000000004) hacia la base.
  return roundCantidad(parsed);
}

function parseDocumentoTipo(value: unknown): RemitoDocumentoTipo | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (parsed === 99) return null;
  if (parsed === 80 || parsed === 86 || parsed === 96) return parsed;
  return fail("El tipo de documento del destinatario no es válido");
}

function parseCondicionIva(value: unknown): CondicionIvaReceptorId | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  const match = CONDICIONES_IVA_RECEPTOR.find((item) => item.id === parsed);
  if (!match) fail("La condición IVA del destinatario no es válida");
  return match.id;
}

function parseDestinatario(value: unknown): Omit<RemitoDestinatario, "condicionIva"> {
  const raw = record(value);
  if (!raw) fail("Completá los datos del destinatario");
  const nombre = optionalText(raw.nombre, "El nombre del destinatario", 200);
  if (!nombre) fail("El nombre del destinatario es obligatorio");
  let tipoDocumento = parseDocumentoTipo(raw.tipoDocumento);
  let numeroDocumento = normalizeDocumentNumber(optionalText(raw.numeroDocumento, "El documento del destinatario", 20)) || null;
  if (!tipoDocumento) {
    tipoDocumento = null;
    numeroDocumento = null;
  } else if (!numeroDocumento) {
    fail("Completá el número de documento del destinatario");
  } else if (tipoDocumento === 96 && !/^\d{7,8}$/.test(numeroDocumento)) {
    fail("El DNI del destinatario debe tener entre 7 y 8 dígitos");
  } else if (tipoDocumento !== 96 && !isValidCuitCuil(numeroDocumento)) {
    fail("El CUIT o CUIL del destinatario no es válido");
  }
  return {
    clienteId: optionalUuid(raw.clienteId, "El cliente del destinatario"),
    nombre,
    domicilio: optionalText(raw.domicilio, "El domicilio del destinatario", 300),
    tipoDocumento,
    numeroDocumento,
    condicionIvaReceptorId: parseCondicionIva(raw.condicionIvaReceptorId),
  };
}

function parseTransportista(value: unknown): RemitoTransportista | null {
  if (value == null) return null;
  const raw = record(value);
  if (!raw) fail("Los datos del transportista no son válidos");
  const nombre = optionalText(raw.nombre, "El nombre del transportista", 200);
  const domicilio = optionalText(raw.domicilio, "El domicilio del transportista", 300);
  const cuit = optionalCuit(raw.cuit, "El CUIT del transportista");
  if (!nombre && !domicilio && !cuit) return null;
  if (!nombre) fail("El nombre del transportista es obligatorio");
  return { nombre, domicilio, cuit };
}

function parseLineas(value: unknown, conFactura: boolean): EmitirRemitoLineaInput[] {
  if (!Array.isArray(value) || value.length === 0) fail("El remito debe tener al menos un ítem");
  if (value.length > REMITO_MAX_LINEAS) fail(`El remito admite hasta ${REMITO_MAX_LINEAS} ítems`);
  return value.map((item, index) => {
    const ordinal = index + 1;
    const raw = record(item);
    if (!raw) fail(`El ítem ${ordinal} del remito no es válido`);
    const cantidad = parseCantidad(raw.cantidad, ordinal);
    const observaciones = optionalText(raw.observaciones, `Las observaciones del ítem ${ordinal}`, 500);
    const facturaLineaId = optionalUuid(raw.facturaLineaId, `La línea de factura del ítem ${ordinal}`);
    const codigo = optionalText(raw.codigo, `El código del ítem ${ordinal}`, 100);
    const descripcion = optionalText(raw.descripcion, `La descripción del ítem ${ordinal}`, 500);
    if (conFactura) {
      if (!facturaLineaId) fail("Cada ítem del remito debe corresponder a una línea de la factura");
    } else if (facturaLineaId) {
      fail("Los ítems de un remito sin factura no pueden referenciar líneas de factura");
    }
    if (!descripcion) fail(`La descripción del ítem ${ordinal} es obligatoria`);
    return {
      facturaLineaId,
      codigo,
      descripcion,
      observaciones,
      cantidad,
    };
  });
}

export function parseEmitirRemitoInput(raw: unknown): Validated<EmitirRemitoInput> {
  return validated(() => {
    const body = record(raw);
    if (!body) fail("Datos inválidos");
    if (!isValidUuid(body.idempotencyKey)) fail("La clave de idempotencia debe ser un UUID válido");
    if (body.clase !== "R" && body.clase !== "X") fail("Seleccioná el tipo de remito (R o X)");
    const arregloId = optionalUuid(body.arregloId, "El arreglo de origen");
    const facturaId = optionalUuid(body.facturaId, "La factura");
    if (arregloId && facturaId) fail("Iniciá el remito desde un arreglo o desde una factura, no desde ambos");
    return {
      idempotencyKey: body.idempotencyKey,
      clase: body.clase,
      arregloId,
      facturaId,
      destinatario: parseDestinatario(body.destinatario),
      transportista: parseTransportista(body.transportista),
      observaciones: optionalText(body.observaciones, "Las observaciones del remito", 1000),
      lineas: parseLineas(body.lineas, Boolean(facturaId)),
    };
  });
}

export function parseAsociarFacturaInput(raw: unknown): Validated<AsociarFacturaInput> {
  return validated(() => {
    const body = record(raw);
    if (!body) fail("Datos inválidos");
    if (!isValidUuid(body.facturaId)) fail("Seleccioná una factura válida");
    if (!Array.isArray(body.lineas) || body.lineas.length === 0) {
      fail("Asociá cada ítem del remito a una línea de la factura");
    }
    if (body.lineas.length > REMITO_MAX_LINEAS) fail(`El remito admite hasta ${REMITO_MAX_LINEAS} ítems`);
    const vistos = new Set<string>();
    const lineas = body.lineas.map((item) => {
      const linea = record(item);
      if (!linea || !isValidUuid(linea.remitoLineaId) || !isValidUuid(linea.facturaLineaId)) {
        fail("Asociá cada ítem del remito a una línea de la factura");
      }
      if (vistos.has(linea.remitoLineaId)) fail("Cada ítem del remito debe asociarse una sola vez");
      vistos.add(linea.remitoLineaId);
      return { remitoLineaId: linea.remitoLineaId, facturaLineaId: linea.facturaLineaId };
    });
    return { facturaId: body.facturaId, lineas };
  });
}

export function parseRemitosConfiguracionInput(raw: unknown): Validated<RemitosConfiguracionInput> {
  return validated(() => {
    const body = record(raw);
    const r = record(body?.remitoR);
    const x = record(body?.remitoX);
    if (!body || !r || !x) fail("Datos inválidos");
    const imprenta = record(r.imprenta) ?? {};

    const cai = optionalText(r.cai, "El CAI", 20);
    if (cai && !/^\d{14}$/.test(cai)) fail("El CAI debe tener 14 dígitos");
    const numeroDesde = optionalInteger(r.numeroDesde, "El número desde", 1, REMITO_NUMERO_MAXIMO);
    const numeroHasta = optionalInteger(r.numeroHasta, "El número hasta", 1, REMITO_NUMERO_MAXIMO);
    if (numeroDesde !== null && numeroHasta !== null && numeroDesde > numeroHasta) {
      fail("El número desde no puede ser mayor al número hasta");
    }
    if (r.autoimpresor !== undefined && typeof r.autoimpresor !== "boolean") fail("La modalidad de impresión no es válida");

    return {
      remitoR: {
        cai,
        caiVencimiento: optionalDate(r.caiVencimiento, "El vencimiento del CAI"),
        puntoEmision: optionalInteger(r.puntoEmision, "El punto de emisión del Remito R", 1, REMITO_PUNTO_EMISION_MAXIMO),
        numeroDesde,
        numeroHasta,
        proximoNumero: requiredInteger(r.proximoNumero, "El próximo número del Remito R", 1, REMITO_NUMERO_MAXIMO),
        inicioActividades: optionalDate(r.inicioActividades, "El inicio de actividades del establecimiento"),
        autoimpresor: r.autoimpresor === true,
        imprenta: {
          razonSocial: optionalText(imprenta.razonSocial, "La razón social de la imprenta", 200),
          cuit: optionalCuit(imprenta.cuit, "El CUIT de la imprenta"),
          fechaImpresion: optionalDate(imprenta.fechaImpresion, "La fecha de impresión"),
          habilitacion: optionalText(imprenta.habilitacion, "El N° de habilitación de la imprenta", 50),
        },
      },
      remitoX: {
        puntoEmision: requiredInteger(x.puntoEmision, "El punto de emisión del Remito X", 1, REMITO_PUNTO_EMISION_MAXIMO),
        proximoNumero: requiredInteger(x.proximoNumero, "El próximo número del Remito X", 1, REMITO_NUMERO_MAXIMO),
      },
    };
  });
}

/** Fecha calendario actual en Argentina (YYYY-MM-DD). */
export function hoyArgentinaISO(date: Date = new Date()): string {
  return toISODateAppTimeZone(date);
}

function pad8(value: number) {
  return String(value).padStart(8, "0");
}

/** Mismas reglas que valida `rpc_remitos_emitir` para R; se usan para avisar antes de emitir. */
export function evaluarRemitoR(config: RemitoRConfiguracion, hoyISO: string = hoyArgentinaISO()): EvaluacionTipo {
  const motivos: string[] = [];
  if (!config.cai) motivos.push("Falta configurar el CAI.");
  if (!config.caiVencimiento) {
    motivos.push("Falta la fecha de vencimiento del CAI.");
  } else if (config.caiVencimiento < hoyISO) {
    const [year, month, day] = config.caiVencimiento.split("-");
    motivos.push(`El CAI está vencido (venció el ${day}/${month}/${year}).`);
  }
  if (!config.puntoEmision) motivos.push("Falta el punto de emisión.");
  if (!config.autoimpresor) {
    const { razonSocial, cuit, fechaImpresion, habilitacion } = config.imprenta;
    if (!razonSocial || !cuit || !fechaImpresion || !habilitacion) {
      motivos.push("Faltan los datos del establecimiento impresor.");
    }
  }
  const proximo = config.proximoNumero;
  if ((config.numeroDesde !== null && proximo < config.numeroDesde)
    || (config.numeroHasta !== null && proximo > config.numeroHasta)) {
    const desde = config.numeroDesde !== null ? pad8(config.numeroDesde) : "sin mínimo";
    const hasta = config.numeroHasta !== null ? pad8(config.numeroHasta) : "sin máximo";
    const numero = config.puntoEmision ? formatRemitoNumero("R", config.puntoEmision, proximo) : `R ${pad8(proximo)}`;
    motivos.push(`El número ${numero} está fuera del rango autorizado (${desde} a ${hasta}).`);
  }
  if (proximo >= REMITO_NUMERO_MAXIMO) motivos.push("Se agotó la numeración para el punto de emisión.");
  return { emitible: motivos.length === 0, motivos };
}

export function evaluarEmisor(config: {
  razonSocial?: string | null;
  cuit?: string | null;
  domicilio?: string | null;
  inicioActividades?: string | null;
} | null): EvaluacionEmisor {
  const faltantes: string[] = [];
  if (!config?.razonSocial?.trim()) faltantes.push("Razón social");
  if (!config?.cuit || !/^\d{11}$/.test(config.cuit)) faltantes.push("CUIT");
  if (!config?.domicilio?.trim()) faltantes.push("Domicilio comercial");
  if (!config?.inicioActividades) faltantes.push("Inicio de actividades");
  return { completo: faltantes.length === 0, faltantes };
}

function roundCantidad(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Cantidades facturadas, ya remitidas y disponibles por línea de factura. */
export function calcularDisponibles(
  lineas: Array<Omit<RemitoFacturaLineaDisponible, "cantidadFacturada" | "cantidadRemitida" | "cantidadDisponible"> & { cantidad: number }>,
  lineasRemitidas: Array<{ facturaLineaId: string | null; cantidad: number }>,
): RemitoFacturaLineaDisponible[] {
  const remitidas = new Map<string, number>();
  for (const remitida of lineasRemitidas) {
    if (!remitida.facturaLineaId) continue;
    remitidas.set(remitida.facturaLineaId, (remitidas.get(remitida.facturaLineaId) ?? 0) + remitida.cantidad);
  }
  return lineas.map(({ cantidad, ...linea }) => {
    const cantidadRemitida = roundCantidad(remitidas.get(linea.id) ?? 0);
    return {
      ...linea,
      cantidadFacturada: roundCantidad(cantidad),
      cantidadRemitida,
      cantidadDisponible: Math.max(0, roundCantidad(cantidad - cantidadRemitida)),
    };
  });
}

function normalizar(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sugiere a qué línea de la factura corresponde cada ítem del remito: primero por código,
 * luego por descripción normalizada, siempre que quede cantidad disponible suficiente.
 */
export function sugerirMapeo(
  lineasRemito: Array<{ id: string; codigo: string | null; descripcion: string; cantidad: number }>,
  lineasFactura: RemitoFacturaLineaDisponible[],
): Record<string, string> {
  const disponible = new Map(lineasFactura.map((linea) => [linea.id, linea.cantidadDisponible]));
  const sugerencias: Record<string, string> = {};
  const asignar = (item: { id: string; cantidad: number }, candidata?: RemitoFacturaLineaDisponible) => {
    if (!candidata) return false;
    sugerencias[item.id] = candidata.id;
    disponible.set(candidata.id, roundCantidad((disponible.get(candidata.id) ?? 0) - item.cantidad));
    return true;
  };
  const alcanza = (linea: RemitoFacturaLineaDisponible, cantidad: number) =>
    (disponible.get(linea.id) ?? 0) + 1e-9 >= cantidad;

  for (const item of lineasRemito) {
    const codigo = normalizar(item.codigo);
    const porCodigo = codigo
      ? lineasFactura.find((linea) => normalizar(linea.codigo) === codigo && alcanza(linea, item.cantidad))
      : undefined;
    if (asignar(item, porCodigo)) continue;
    const descripcion = normalizar(item.descripcion);
    asignar(item, lineasFactura.find((linea) => normalizar(linea.descripcion) === descripcion && alcanza(linea, item.cantidad)));
  }
  return sugerencias;
}

/** Excesos por línea de factura para un mapeo propuesto (para validar en vivo en la UI). */
export function excesosDeMapeo(
  lineasRemito: Array<{ id: string; cantidad: number }>,
  mapeo: Record<string, string>,
  lineasFactura: RemitoFacturaLineaDisponible[],
): Record<string, number> {
  const pedidos = new Map<string, number>();
  for (const item of lineasRemito) {
    const facturaLineaId = mapeo[item.id];
    if (facturaLineaId) pedidos.set(facturaLineaId, (pedidos.get(facturaLineaId) ?? 0) + item.cantidad);
  }
  const excesos: Record<string, number> = {};
  for (const linea of lineasFactura) {
    const exceso = roundCantidad((pedidos.get(linea.id) ?? 0) - linea.cantidadDisponible);
    if (exceso > 0) excesos[linea.id] = exceso;
  }
  return excesos;
}
