import { CATEGORIAS_GASTO_FINANCIERO } from "@/model/finanzas";
import type {
  ActualizarCuentaFinancieraInput,
  ActualizarGastoFinancieroInput,
  ActualizarTransferenciaFinancieraInput,
  CrearCuentaFinancieraInput,
  CrearGastoFinancieroInput,
  CrearTransferenciaFinancieraInput,
  CuentaFinanciera,
  GastoFinanciero,
  MovimientoFinanciero,
  TipoCuentaFinanciera,
  TransferenciaFinanciera,
} from "@/model/finanzas";

type JsonRecord = Record<string, unknown>;

export const ACCOUNT_TYPES: readonly TipoCuentaFinanciera[] = [
  "EFECTIVO",
  "CUENTA_BANCARIA",
  "BILLETERA_DIGITAL",
  "TARJETA_CREDITO",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2_000;

export type Validated<T> = { value?: T; error?: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function stringValue(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function nullableStringValue(record: JsonRecord, key: string): string | null | undefined {
  if (!own(record, key)) return undefined;
  const value = record[key];
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : undefined;
}

function numberValue(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableUuidValue(record: JsonRecord, key: string): string | null | undefined {
  const value = nullableStringValue(record, key);
  if (value === null || value === undefined) return value;
  return UUID_RE.test(value) ? value : undefined;
}

function textError(value: string | undefined, field: string, maxLength = MAX_TEXT_LENGTH): string | null {
  if (!value) return `Falta ${field}`;
  if (value.length > maxLength) return `${field} supera el máximo de ${maxLength} caracteres`;
  return null;
}

function validTimestamp(value: string): boolean {
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function toTimestamp(value: string): string {
  return DATE_ONLY_RE.test(value) ? `${value}T12:00:00.000Z` : value;
}

function validOptionalTimestamp(value: string | undefined, field = "fecha"): string | null {
  if (value === undefined) return null;
  return validTimestamp(value) ? null : `${field} debe ser una fecha válida`;
}

function validId(value: string | undefined, field: string): string | null {
  return value && UUID_RE.test(value) ? null : `${field} debe ser un UUID válido`;
}

function optionalIdError(value: string | null | undefined, field: string): string | null {
  if (value === undefined || value === null) return null;
  return UUID_RE.test(value) ? null : `${field} debe ser un UUID válido`;
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function pick(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (own(record, key)) return record[key];
  }
  return undefined;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asTimestamp(value: unknown): string | null {
  return asText(value);
}

function isAccountType(value: unknown): value is TipoCuentaFinanciera {
  return typeof value === "string" && (ACCOUNT_TYPES as readonly string[]).includes(value);
}

function isExpenseCategory(value: unknown): boolean {
  return typeof value === "string" && (CATEGORIAS_GASTO_FINANCIERO as readonly string[]).includes(value);
}

export function validateCreateCuenta(body: unknown): Validated<CrearCuentaFinancieraInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const nombre = stringValue(body, "nombre");
  const tipo = stringValue(body, "tipo");
  const saldoInicial = own(body, "saldoInicial") ? numberValue(body, "saldoInicial") : undefined;
  const fecha = own(body, "fecha") ? stringValue(body, "fecha") : undefined;
  const idempotencyKey = own(body, "idempotencyKey") ? stringValue(body, "idempotencyKey") : undefined;

  const nombreError = textError(nombre, "nombre");
  if (nombreError) return { error: nombreError };
  if (!isAccountType(tipo)) return { error: "tipo de cuenta inválido" };
  if (own(body, "saldoInicial") && saldoInicial === undefined) return { error: "saldoInicial debe ser un número válido" };
  if (own(body, "fecha") && fecha === undefined) return { error: "fecha debe ser texto" };
  const fechaError = validOptionalTimestamp(fecha);
  if (fechaError) return { error: fechaError };
  if (own(body, "idempotencyKey") && idempotencyKey === undefined) return { error: "idempotencyKey debe ser texto" };
  if (idempotencyKey && !UUID_RE.test(idempotencyKey)) return { error: "idempotencyKey debe ser un UUID válido" };

  return {
    value: {
      nombre: nombre!,
      tipo,
      ...(saldoInicial === undefined ? {} : { saldoInicial }),
      ...(fecha === undefined ? {} : { fecha: toTimestamp(fecha) }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
  };
}

export function validateUpdateCuenta(body: unknown): Validated<ActualizarCuentaFinancieraInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const patch: ActualizarCuentaFinancieraInput = {};
  if (own(body, "nombre")) {
    const nombre = stringValue(body, "nombre");
    const error = textError(nombre, "nombre");
    if (error) return { error };
    patch.nombre = nombre;
  }
  if (own(body, "tipo")) {
    const tipo = stringValue(body, "tipo");
    if (!isAccountType(tipo)) return { error: "tipo de cuenta inválido" };
    patch.tipo = tipo;
  }
  if (own(body, "activo")) {
    if (typeof body.activo !== "boolean") return { error: "activo debe ser booleano" };
    patch.activo = body.activo;
  }
  if (Object.keys(patch).length === 0) return { error: "No hay campos para actualizar" };
  return { value: patch };
}

export function validateCreateTransferencia(body: unknown): Validated<CrearTransferenciaFinancieraInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const cuentaOrigenId = stringValue(body, "cuentaOrigenId");
  const cuentaDestinoId = stringValue(body, "cuentaDestinoId");
  const importe = numberValue(body, "importe");
  const fecha = own(body, "fecha") ? stringValue(body, "fecha") : undefined;
  const descripcion = nullableStringValue(body, "descripcion");
  const idempotencyKey = own(body, "idempotencyKey") ? stringValue(body, "idempotencyKey") : undefined;

  const origenError = validId(cuentaOrigenId, "cuentaOrigenId");
  if (origenError) return { error: origenError };
  const destinoError = validId(cuentaDestinoId, "cuentaDestinoId");
  if (destinoError) return { error: destinoError };
  if (cuentaOrigenId === cuentaDestinoId) return { error: "Las cuentas de una transferencia deben ser distintas" };
  if (importe === undefined || importe <= 0) return { error: "importe debe ser un número mayor a 0" };
  if (own(body, "fecha") && fecha === undefined) return { error: "fecha debe ser texto" };
  const fechaError = validOptionalTimestamp(fecha);
  if (fechaError) return { error: fechaError };
  if (own(body, "descripcion") && descripcion === undefined) return { error: "descripcion debe ser texto o null" };
  if (descripcion !== undefined && descripcion !== null && descripcion.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `descripcion supera el máximo de ${MAX_DESCRIPTION_LENGTH} caracteres` };
  }
  if (own(body, "idempotencyKey") && idempotencyKey === undefined) return { error: "idempotencyKey debe ser texto" };
  if (idempotencyKey && !UUID_RE.test(idempotencyKey)) return { error: "idempotencyKey debe ser un UUID válido" };

  return {
    value: {
      cuentaOrigenId: cuentaOrigenId!,
      cuentaDestinoId: cuentaDestinoId!,
      importe,
      ...(fecha === undefined ? {} : { fecha: toTimestamp(fecha) }),
      ...(descripcion === undefined ? {} : { descripcion }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
  };
}

export function validateUpdateTransferencia(body: unknown): Validated<ActualizarTransferenciaFinancieraInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const patch: ActualizarTransferenciaFinancieraInput = {};
  if (own(body, "cuentaOrigenId")) {
    const cuentaOrigenId = stringValue(body, "cuentaOrigenId");
    const error = validId(cuentaOrigenId, "cuentaOrigenId");
    if (error) return { error };
    patch.cuentaOrigenId = cuentaOrigenId;
  }
  if (own(body, "cuentaDestinoId")) {
    const cuentaDestinoId = stringValue(body, "cuentaDestinoId");
    const error = validId(cuentaDestinoId, "cuentaDestinoId");
    if (error) return { error };
    patch.cuentaDestinoId = cuentaDestinoId;
  }
  if (patch.cuentaOrigenId && patch.cuentaDestinoId && patch.cuentaOrigenId === patch.cuentaDestinoId) {
    return { error: "Las cuentas de una transferencia deben ser distintas" };
  }
  if (own(body, "importe")) {
    const importe = numberValue(body, "importe");
    if (importe === undefined || importe <= 0) return { error: "importe debe ser un número mayor a 0" };
    patch.importe = importe;
  }
  if (own(body, "fecha")) {
    const fecha = stringValue(body, "fecha");
    const error = validOptionalTimestamp(fecha);
    if (error || !fecha) return { error: error ?? "Falta fecha" };
    patch.fecha = toTimestamp(fecha);
  }
  if (own(body, "descripcion")) {
    const descripcion = nullableStringValue(body, "descripcion");
    if (descripcion === undefined) return { error: "descripcion debe ser texto o null" };
    if (descripcion !== null && descripcion.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `descripcion supera el máximo de ${MAX_DESCRIPTION_LENGTH} caracteres` };
    }
    patch.descripcion = descripcion;
  }
  if (Object.keys(patch).length === 0) return { error: "No hay campos para actualizar" };
  if (own(body, "idempotencyKey")) {
    const idempotencyKey = stringValue(body, "idempotencyKey");
    if (idempotencyKey === undefined) return { error: "idempotencyKey debe ser texto" };
    if (!UUID_RE.test(idempotencyKey)) return { error: "idempotencyKey debe ser un UUID válido" };
    patch.idempotencyKey = idempotencyKey;
  }
  return { value: patch };
}

export function validateCreateGasto(body: unknown): Validated<CrearGastoFinancieroInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const cuentaId = stringValue(body, "cuentaId");
  const categoria = stringValue(body, "categoria");
  const importe = numberValue(body, "importe");
  const descripcion = stringValue(body, "descripcion");
  const fecha = own(body, "fecha") ? stringValue(body, "fecha") : undefined;
  const arregloId = own(body, "arregloId") ? nullableUuidValue(body, "arregloId") : undefined;
  const operacionId = own(body, "operacionId") ? nullableUuidValue(body, "operacionId") : undefined;
  const idempotencyKey = own(body, "idempotencyKey") ? stringValue(body, "idempotencyKey") : undefined;

  const cuentaError = validId(cuentaId, "cuentaId");
  if (cuentaError) return { error: cuentaError };
  const categoriaError = textError(categoria, "categoria");
  if (categoriaError) return { error: categoriaError };
  if (!isExpenseCategory(categoria)) return { error: "categoria de gasto inválida" };
  if (importe === undefined || importe <= 0) return { error: "importe debe ser un número mayor a 0" };
  const descripcionError = textError(descripcion, "descripcion", MAX_DESCRIPTION_LENGTH);
  if (descripcionError) return { error: descripcionError };
  if (own(body, "fecha") && fecha === undefined) return { error: "fecha debe ser texto" };
  const fechaError = validOptionalTimestamp(fecha);
  if (fechaError) return { error: fechaError };
  const arregloIdError = optionalIdError(arregloId, "arregloId");
  if (arregloIdError) return { error: arregloIdError };
  const operacionIdError = optionalIdError(operacionId, "operacionId");
  if (operacionIdError) return { error: operacionIdError };
  if (own(body, "arregloId") && arregloId === undefined) return { error: "arregloId debe ser un UUID válido o null" };
  if (own(body, "operacionId") && operacionId === undefined) return { error: "operacionId debe ser un UUID válido o null" };
  if (own(body, "idempotencyKey") && idempotencyKey === undefined) return { error: "idempotencyKey debe ser texto" };
  if (idempotencyKey && !UUID_RE.test(idempotencyKey)) return { error: "idempotencyKey debe ser un UUID válido" };

  return {
    value: {
      cuentaId: cuentaId!,
      categoria: categoria!,
      importe,
      descripcion: descripcion!,
      ...(fecha === undefined ? {} : { fecha: toTimestamp(fecha) }),
      ...(arregloId === undefined ? {} : { arregloId }),
      ...(operacionId === undefined ? {} : { operacionId }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
  };
}

export function validateUpdateGasto(body: unknown): Validated<ActualizarGastoFinancieroInput> {
  if (!isRecord(body)) return { error: "JSON inválido" };
  const patch: ActualizarGastoFinancieroInput = {};
  if (own(body, "cuentaId")) {
    const cuentaId = stringValue(body, "cuentaId");
    const error = validId(cuentaId, "cuentaId");
    if (error) return { error };
    patch.cuentaId = cuentaId;
  }
  if (own(body, "categoria")) {
    const categoria = stringValue(body, "categoria");
    const error = textError(categoria, "categoria");
    if (error) return { error };
    if (!isExpenseCategory(categoria)) return { error: "categoria de gasto inválida" };
    patch.categoria = categoria;
  }
  if (own(body, "importe")) {
    const importe = numberValue(body, "importe");
    if (importe === undefined || importe <= 0) return { error: "importe debe ser un número mayor a 0" };
    patch.importe = importe;
  }
  if (own(body, "fecha")) {
    const fecha = stringValue(body, "fecha");
    const error = validOptionalTimestamp(fecha);
    if (error || !fecha) return { error: error ?? "Falta fecha" };
    patch.fecha = toTimestamp(fecha);
  }
  if (own(body, "descripcion")) {
    const descripcion = stringValue(body, "descripcion");
    const error = textError(descripcion, "descripcion", MAX_DESCRIPTION_LENGTH);
    if (error) return { error };
    patch.descripcion = descripcion;
  }
  if (Object.keys(patch).length === 0) return { error: "No hay campos para actualizar" };
  if (own(body, "idempotencyKey")) {
    const idempotencyKey = stringValue(body, "idempotencyKey");
    if (idempotencyKey === undefined) return { error: "idempotencyKey debe ser texto" };
    if (!UUID_RE.test(idempotencyKey)) return { error: "idempotencyKey debe ser un UUID válido" };
    patch.idempotencyKey = idempotencyKey;
  }
  return { value: patch };
}

export function validateUuid(id: string | undefined, field = "id"): string | null {
  return validId(id?.trim(), field);
}

export function parseListFilters(url: URL): Validated<{ desde: string | null; hasta: string | null; limit: number | null; offset: number | null }> {
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (desde && !validTimestamp(desde)) return { error: "desde debe ser una fecha válida" };
  if (hasta && !validTimestamp(hasta)) return { error: "hasta debe ser una fecha válida" };
  if (desde && hasta && new Date(desde).getTime() > new Date(hasta).getTime()) {
    return { error: "desde no puede ser posterior a hasta" };
  }

  const parseInteger = (raw: string | null, key: string, min: number, max: number): Validated<number | null> => {
    if (raw === null) return { value: null };
    if (!/^\d+$/.test(raw)) return { error: `${key} debe ser un entero` };
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      return { error: `${key} debe estar entre ${min} y ${max}` };
    }
    return { value };
  };
  const limit = parseInteger(url.searchParams.get("limit"), "limit", 1, 200);
  if (limit.error || limit.value === undefined) return { error: limit.error ?? "limit inválido" };
  const offset = parseInteger(url.searchParams.get("offset"), "offset", 0, 100_000);
  if (offset.error || offset.value === undefined) return { error: offset.error ?? "offset inválido" };

  const toStartTimestamp = (value: string | null): string | null => {
    if (!value) return null;
    return DATE_ONLY_RE.test(value) ? `${value}T00:00:00.000Z` : value;
  };
  const toEndTimestampExclusive = (value: string | null): string | null => {
    if (!value || !DATE_ONLY_RE.test(value)) return value;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  };

  return {
    value: {
      desde: toStartTimestamp(desde),
      hasta: toEndTimestampExclusive(hasta),
      limit: limit.value,
      offset: offset.value,
    },
  };
}

export function mapCuenta(row: unknown): CuentaFinanciera | null {
  const source = asRecord(row);
  if (!source) return null;
  const id = asText(pick(source, "id"));
  const nombre = asText(pick(source, "nombre"));
  const tipo = pick(source, "tipo");
  const saldoInicial = asNumber(pick(source, "saldo_inicial", "saldoInicial")) ?? 0;
  const saldoActual = asNumber(pick(source, "saldo", "saldo_actual", "saldoActual"));
  const activo = asBoolean(pick(source, "activo"));
  const createdAt = asTimestamp(pick(source, "created_at", "createdAt"));
  const updatedAt = asTimestamp(pick(source, "updated_at", "updatedAt"));
  if (!id || !nombre || !isAccountType(tipo) || saldoActual === null || activo === null || !createdAt || !updatedAt) {
    return null;
  }
  return { id, nombre, tipo, saldoInicial, saldoActual, activo, createdAt, updatedAt };
}

export function mapMovimiento(row: unknown): MovimientoFinanciero | null {
  const source = asRecord(row);
  if (!source) return null;
  const id = asText(pick(source, "id", "movimiento_id"));
  const cuentaId = asText(pick(source, "cuenta_financiera_id", "cuenta_id", "cuentaId"));
  const tipo = asText(pick(source, "tipo")) ?? "MOVIMIENTO";
  const importe = asNumber(pick(source, "importe"));
  const fecha = asTimestamp(pick(source, "fecha"));
  const createdAt = asTimestamp(pick(source, "created_at", "createdAt"));
  if (!id || !cuentaId || importe === null || !fecha || !createdAt) return null;
  return {
    id,
    cuentaId,
    tipo,
    importe,
    fecha,
    descripcion: asNullableText(pick(source, "descripcion")),
    categoria: asNullableText(pick(source, "categoria_gasto", "categoria")),
    operacionId: asNullableText(pick(source, "operacion_id", "operacionId")),
    reversaMovimientoId: null, // deprecated en nueva arquitectura
    createdAt,
  };
}

export function mapTransferencia(row: unknown): TransferenciaFinanciera | null {
  const source = asRecord(row);
  if (!source) return null;
  const id = asText(pick(source, "transferencia_id", "id"));
  const cuentaOrigenId = asText(pick(source, "cuenta_origen_id", "cuentaOrigenId"));
  const cuentaOrigenNombre = asNullableText(pick(source, "cuenta_origen_nombre", "cuentaOrigenNombre"));
  const cuentaDestinoId = asText(pick(source, "cuenta_destino_id", "cuentaDestinoId"));
  const cuentaDestinoNombre = asNullableText(pick(source, "cuenta_destino_nombre", "cuentaDestinoNombre"));
  const importe = asNumber(pick(source, "importe"));
  const fecha = asTimestamp(pick(source, "fecha"));
  const createdAt = asTimestamp(pick(source, "created_at", "createdAt"));
  if (!id || !cuentaOrigenId || !cuentaDestinoId || importe === null || !fecha || !createdAt) return null;
  return {
    id,
    cuentaOrigenId,
    cuentaOrigenNombre,
    cuentaDestinoId,
    cuentaDestinoNombre,
    importe,
    fecha,
    descripcion: asNullableText(pick(source, "descripcion")),
    reversaMovimientoId: asNullableText(pick(source, "reversa_movimiento_id", "reversaMovimientoId")),
    createdAt,
  };
}

export function mapGasto(row: unknown): GastoFinanciero | null {
  const source = asRecord(row);
  if (!source) return null;
  const id = asText(pick(source, "gasto_id", "id"));
  const cuentaId = asText(pick(source, "cuenta_financiera_id", "cuenta_id", "cuentaId"));
  const cuentaNombre = asNullableText(pick(source, "cuenta_financiera_nombre", "cuenta_nombre", "cuentaNombre"));
  const categoria = asText(pick(source, "categoria_gasto", "categoria"));
  const importe = asNumber(pick(source, "importe", "monto"));
  const fecha = asTimestamp(pick(source, "fecha"));
  const descripcion = asText(pick(source, "descripcion"));
  const createdAt = asTimestamp(pick(source, "created_at", "createdAt"));
  if (!id || !cuentaId || !categoria || importe === null || !fecha || !descripcion || !createdAt) return null;
  return {
    id,
    cuentaId,
    cuentaNombre,
    categoria,
    importe: Math.abs(importe), // el ledger almacena negativo, mostrar positivo
    fecha,
    descripcion,
    reversaMovimientoId: null, // deprecated en nueva arquitectura
    createdAt,
  };
}

export function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
}

export function mapRows<T>(value: unknown, mapper: (row: unknown) => T | null): T[] | null {
  const rows = asRows(value).map(mapper);
  return rows.some((row) => row === null) ? null : (rows as T[]);
}

export function extractRpcId(value: unknown): string | null {
  if (typeof value === "string" && UUID_RE.test(value)) return value;
  const source = asRecord(value);
  const id = source ? asText(pick(source, "id")) : null;
  return id && UUID_RE.test(id) ? id : null;
}

export function rpcStatus(error: { code?: string | null } | null | undefined): 400 | 403 | 404 | 409 | 500 {
  switch (error?.code) {
    case "PGRST116":
    case "P0002":
      return 404;
    case "23505":
    case "55000":
      return 409;
    case "22023":
    case "22003":
    case "22007":
    case "22P02":
      return 400;
    case "28000":
      return 403;
    default:
      return 500;
  }
}
