import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/supabase/server";

import {
  amountToCents,
  buildComprobantePayload,
  centsToAmount,
  deriveFacturaConcepto,
  determineVoucher,
  FacturacionValidationError,
  fiscalizeLineas,
  isValidCuitCuil,
  normalizeDocumentNumber,
  toIsoDate,
  validateDocument,
  validateFechas,
  validateLineasYTotal,
} from "./arcaPayload";
import { createArcaGateway, sanitizeFiscalPayload } from "./afipGateway";
import { deleteCredentialPair, downloadCredentialPair, uploadCredentialPair } from "./credentialStorage";
import { generateFiscalInvoicePdf, type FiscalPdfInvoice } from "./fiscalPdf";
import {
  CONDICIONES_IVA_RECEPTOR,
  type CondicionIvaEmisor,
  type CondicionIvaReceptorId,
  type DocumentoFiscalClase,
  type DocumentoFiscalTipo,
  type FacturaElectronicaDetalle,
  type FacturaElectronicaResumen,
  type FacturaFechaInput,
  type FacturaLinea,
  type FacturaOrigenTipo,
  type FacturacionAmbiente,
  type FacturacionConfiguracionPublica,
  type FacturacionPreflight,
  type FacturasPaginadas,
  type PerfilFiscalCliente,
} from "./types";
import type { TenantActor } from "./serverAuth";

type DbRecord = Record<string, unknown>;

type StoredConfig = {
  ambiente: FacturacionAmbiente;
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  condicionIvaEmisor: CondicionIvaEmisor;
  domicilio: string;
  ingresosBrutos: string | null;
  inicioActividades: string;
  puntoVenta: number;
  habilitada: boolean;
  fceMontoMinimo: number | null;
  certificatePath: string | null;
  privateKeyPath: string | null;
  certificateOriginalFilename: string | null;
  privateKeyOriginalFilename: string | null;
  fingerprintSha256: string | null;
  certificateExpiresAt: string | null;
  credentialsUpdatedAt: string | null;
};

type CanonicalSource = {
  id: string;
  origenTipo: FacturaOrigenTipo;
  fecha: string | null;
  total: number;
  receptor: PerfilFiscalCliente;
  lineas: FacturaLinea[];
};

export type FacturaIssueInput = {
  idempotencyKey: string;
  ambiente: FacturacionAmbiente;
  condicionVenta: string;
  receptor: {
    tipoDocumento: DocumentoFiscalTipo | null;
    numeroDocumento: string | null;
    condicionIvaReceptorId: CondicionIvaReceptorId | null;
  };
  fechas: FacturaFechaInput;
};

export type FacturaIssueResult = {
  invoice: FacturaElectronicaResumen;
  httpStatus: number;
  message?: string;
};

export type FacturasListFilters = {
  page?: number;
  pageSize?: number;
  estado?: string | null;
  ambiente?: string | null;
  documentoTipo?: string | null;
  desde?: string | null;
  hasta?: string | null;
  search?: string | null;
};

function record(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DbRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: unknown): string | null {
  return text(value) || null;
}

function parseAmbiente(value: unknown): FacturacionAmbiente {
  const normalized = text(value);
  if (!normalized || normalized === "HOMOLOGACION") return "HOMOLOGACION";
  if (normalized === "PRODUCCION") return "PRODUCCION";
  throw new FacturacionValidationError("El ambiente fiscal no es válido");
}

function parseCondicion(value: unknown): CondicionIvaReceptorId | null {
  const parsed = number(value) as CondicionIvaReceptorId;
  return CONDICIONES_IVA_RECEPTOR.some((item) => item.id === parsed) ? parsed : null;
}

function parseDocumento(value: unknown): DocumentoFiscalTipo | null {
  const parsed = number(value) as DocumentoFiscalTipo;
  return parsed === 80 || parsed === 86 || parsed === 96 || parsed === 99 ? parsed : null;
}

function assertUuid(value: unknown, label: string): string {
  const normalized = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new FacturacionValidationError(`${label} debe ser un UUID válido`);
  }
  return normalized;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function mapConfig(value: unknown): StoredConfig | null {
  if (!value) return null;
  const row = record(value);
  const certificatePath = nullable(row.cert_storage_path);
  const privateKeyPath = nullable(row.key_storage_path);
  const certificateExpiresAt = nullable(row.cert_expires_at);
  const credentials = Boolean(certificatePath && privateKeyPath);
  const certificateValid = !certificateExpiresAt
    || new Date(certificateExpiresAt).getTime() > Date.now();
  return {
    ambiente: parseAmbiente(row.ambiente),
    razonSocial: text(row.razon_social),
    nombreFantasia: nullable(row.nombre_fantasia),
    cuit: normalizeDocumentNumber(text(row.cuit)),
    condicionIvaEmisor: text(row.condicion_iva_emisor) === "RESPONSABLE_INSCRIPTO"
      ? "RESPONSABLE_INSCRIPTO" : "MONOTRIBUTISTA",
    domicilio: text(row.domicilio),
    ingresosBrutos: nullable(row.ingresos_brutos),
    inicioActividades: text(row.inicio_actividades),
    puntoVenta: number(row.punto_venta),
    habilitada: row.habilitada !== false && credentials && certificateValid,
    fceMontoMinimo: row.fce_monto_minimo == null ? null : number(row.fce_monto_minimo),
    certificatePath,
    privateKeyPath,
    certificateOriginalFilename: nullable(row.cert_original_filename),
    privateKeyOriginalFilename: nullable(row.key_original_filename),
    fingerprintSha256: nullable(row.cert_fingerprint_sha256),
    certificateExpiresAt,
    credentialsUpdatedAt: nullable(row.credenciales_updated_at),
  };
}

function publicConfig(config: StoredConfig): FacturacionConfiguracionPublica {
  const configured = Boolean(config.certificatePath && config.privateKeyPath);
  return {
    razonSocial: config.razonSocial,
    nombreFantasia: config.nombreFantasia,
    cuit: config.cuit,
    condicionIvaEmisor: config.condicionIvaEmisor,
    domicilio: config.domicilio,
    ingresosBrutos: config.ingresosBrutos,
    inicioActividades: config.inicioActividades,
    puntoVenta: config.puntoVenta,
    habilitada: config.habilitada && configured,
    ambiente: config.ambiente,
    fceMontoMinimo: config.fceMontoMinimo,
    credenciales: {
      configuradas: configured,
      certificadoNombre: config.certificateOriginalFilename,
      clavePrivadaNombre: config.privateKeyOriginalFilename,
      fingerprintSha256: config.fingerprintSha256,
      vencimiento: config.certificateExpiresAt,
      actualizadasAt: config.credentialsUpdatedAt,
    },
  };
}

export function validateConfigurationInput(value: unknown): FacturacionConfiguracionPublica {
  const row = record(value);
  const config: FacturacionConfiguracionPublica = {
    razonSocial: text(row.razonSocial),
    nombreFantasia: nullable(row.nombreFantasia),
    cuit: normalizeDocumentNumber(text(row.cuit)),
    condicionIvaEmisor: text(row.condicionIvaEmisor) === "RESPONSABLE_INSCRIPTO"
      ? "RESPONSABLE_INSCRIPTO" : "MONOTRIBUTISTA",
    domicilio: text(row.domicilio),
    ingresosBrutos: nullable(row.ingresosBrutos),
    inicioActividades: text(row.inicioActividades),
    puntoVenta: number(row.puntoVenta),
    habilitada: row.habilitada !== false,
    ambiente: parseAmbiente(row.ambiente),
    fceMontoMinimo: row.fceMontoMinimo == null || row.fceMontoMinimo === ""
      ? null : number(row.fceMontoMinimo),
    credenciales: {
      configuradas: false, certificadoNombre: null, clavePrivadaNombre: null,
      fingerprintSha256: null, vencimiento: null, actualizadasAt: null,
    },
  };
  if (!config.razonSocial || !config.domicilio || !isValidCuitCuil(config.cuit)) {
    throw new FacturacionValidationError("Razón social, domicilio y un CUIT válido son obligatorios");
  }
  if (!isIsoDate(config.inicioActividades)) {
    throw new FacturacionValidationError("El inicio de actividades debe ser una fecha válida con formato AAAA-MM-DD");
  }
  if (!Number.isInteger(config.puntoVenta) || config.puntoVenta <= 0) {
    throw new FacturacionValidationError("El punto de venta debe ser un entero positivo");
  }
  if (config.fceMontoMinimo != null && config.fceMontoMinimo <= 0) {
    throw new FacturacionValidationError("El monto mínimo FCE debe ser positivo");
  }
  return config;
}

async function getStoredConfig(
  tenantId: string,
  ambiente: FacturacionAmbiente = "HOMOLOGACION",
): Promise<StoredConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturacion_configuracion_ambiente")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ambiente", ambiente)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la configuración fiscal");
  return mapConfig(data);
}

export async function getFacturacionConfig(
  tenantId: string,
  ambiente: FacturacionAmbiente = "HOMOLOGACION",
): Promise<FacturacionConfiguracionPublica | null> {
  const config = await getStoredConfig(tenantId, ambiente);
  return config ? publicConfig(config) : null;
}

export async function saveFacturacionConfig(
  tenantId: string,
  userId: string,
  input: unknown,
  certificate?: File,
  privateKey?: File,
): Promise<FacturacionConfiguracionPublica> {
  const config = validateConfigurationInput(input);
  if (Boolean(certificate) !== Boolean(privateKey)) {
    throw new FacturacionValidationError("Debe seleccionar certificado y clave privada juntos");
  }
  const supabase = await createClient();
  const previous = await getStoredConfig(tenantId, config.ambiente);
  const uploaded = certificate && privateKey
    ? await uploadCredentialPair(tenantId, certificate, privateKey, config.ambiente)
    : null;
  const credentialsConfigured = Boolean(uploaded || (previous?.certificatePath && previous.privateKeyPath));
  const { data, error } = await supabase
    .from("facturacion_configuracion_ambiente")
    .upsert({
      tenant_id: tenantId,
      ambiente: config.ambiente,
      razon_social: config.razonSocial,
      nombre_fantasia: config.nombreFantasia,
      cuit: config.cuit,
      condicion_iva_emisor: config.condicionIvaEmisor,
      domicilio: config.domicilio,
      ingresos_brutos: config.ingresosBrutos,
      inicio_actividades: config.inicioActividades,
      punto_venta: config.puntoVenta,
      habilitada: config.habilitada && credentialsConfigured,
      fce_monto_minimo: config.fceMontoMinimo,
      ...(uploaded ? {
        cert_storage_path: uploaded.certificatePath,
        key_storage_path: uploaded.privateKeyPath,
        cert_original_filename: uploaded.certificateOriginalFilename,
        key_original_filename: uploaded.privateKeyOriginalFilename,
        cert_fingerprint_sha256: uploaded.fingerprintSha256,
        cert_expires_at: uploaded.expiresAt,
        credenciales_updated_at: new Date().toISOString(),
        credenciales_updated_by: userId,
      } : {}),
    }, { onConflict: "tenant_id,ambiente" })
    .select("*")
    .single();
  if (error || !data) {
    if (uploaded) await deleteCredentialPair(uploaded.certificatePath, uploaded.privateKeyPath).catch(() => undefined);
    throw new Error("No se pudo guardar la configuración fiscal");
  }
  if (uploaded && previous) {
    await deleteCredentialPair(previous.certificatePath, previous.privateKeyPath).catch(() => undefined);
  }
  const stored = mapConfig(data);
  if (!stored) throw new Error("No se pudo leer la configuración guardada");
  return publicConfig(stored);
}

async function createGateway(config: StoredConfig) {
  if (!config.certificatePath || !config.privateKeyPath) {
    throw new FacturacionValidationError("Falta subir el certificado y la clave privada fiscal");
  }
  if (config.certificateExpiresAt && new Date(config.certificateExpiresAt).getTime() <= Date.now()) {
    throw new FacturacionValidationError("El certificado fiscal está vencido y debe reemplazarse");
  }
  const credentials = await downloadCredentialPair(config.certificatePath, config.privateKeyPath);
  return createArcaGateway({
    cuit: config.cuit,
    production: config.ambiente === "PRODUCCION",
    ...credentials,
  });
}

export async function testFacturacionConnection(
  tenantId: string,
  ambiente: FacturacionAmbiente = "HOMOLOGACION",
) {
  const config = await getStoredConfig(tenantId, ambiente);
  if (!config) throw new FacturacionValidationError("La configuración fiscal está incompleta");
  const gateway = await createGateway(config);
  const tipo = determineVoucher(config.condicionIvaEmisor, 5).tipo;
  const [status, lastVoucher] = await Promise.all([
    gateway.getServerStatus(), gateway.getLastVoucher(config.puntoVenta, tipo),
  ]);
  return { status: sanitizeFiscalPayload(status), ultimoComprobante: lastVoucher, ambiente };
}

async function getClientProfile(tenantId: string, clienteId: string | null): Promise<PerfilFiscalCliente> {
  if (!clienteId) {
    return {
      clienteId: null, nombre: "Consumidor final", domicilio: null,
      tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5,
      fceMipymeAlcanzado: false,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, tipo_cliente, tipo_documento_fiscal, numero_documento_fiscal, condicion_iva_receptor_id, fce_mipyme_alcanzado")
    .eq("id", clienteId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Cliente no encontrado");
  const client = record(data);
  const company = text(client.tipo_cliente) === "empresa";
  const { data: identity } = company
    ? await supabase.from("empresas").select("nombre, direccion").eq("id", clienteId).maybeSingle()
    : await supabase.from("particulares").select("nombre, apellido, direccion").eq("id", clienteId).maybeSingle();
  const profile = record(identity);
  return {
    clienteId,
    nombre: company ? text(profile.nombre) || "Cliente"
      : [text(profile.nombre), text(profile.apellido)].filter(Boolean).join(" ") || "Cliente",
    domicilio: nullable(profile.direccion),
    tipoDocumento: parseDocumento(client.tipo_documento_fiscal),
    numeroDocumento: nullable(client.numero_documento_fiscal),
    condicionIvaReceptorId: parseCondicion(client.condicion_iva_receptor_id),
    fceMipymeAlcanzado: client.fce_mipyme_alcanzado === true,
  };
}

function appendLine(lineas: FacturaLinea[], input: Omit<FacturaLinea, "ordinal" | "subtotal">) {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new FacturacionValidationError("La cantidad de una línea no es válida");
  }
  const subtotal = Math.round(amountToCents(input.importeUnitario) * input.cantidad);
  if (subtotal <= 0) return;
  lineas.push({
    ...input, ordinal: lineas.length + 1,
    importeUnitario: centsToAmount(amountToCents(input.importeUnitario)),
    subtotal: centsToAmount(subtotal),
  });
}

async function resolveStockLines(
  tenantId: string,
  operationIds: string[],
  origen: "REPUESTO" | "VENTA",
): Promise<FacturaLinea[]> {
  if (!operationIds.length) return [];
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("operaciones_lineas")
    .select("id, operacion_id, stock_id, cantidad, monto_unitario, iva_alicuota_id, created_at")
    .in("operacion_id", operationIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error("No se pudieron cargar las líneas de productos");
  const stockIds = (rows ?? []).map((row) => text(record(row).stock_id)).filter(Boolean);
  const stockMap = new Map<string, DbRecord>();
  if (stockIds.length) {
    const { data: stocks, error: stockError } = await supabase
      .from("stocks").select("id, producto_id").in("id", stockIds).eq("tenant_id", tenantId);
    if (stockError) throw new Error("No se pudo resolver el stock");
    (stocks ?? []).forEach((item) => stockMap.set(text(record(item).id), record(item)));
  }
  const productIds = Array.from(stockMap.values()).map((row) => text(row.producto_id)).filter(Boolean);
  const products = new Map<string, DbRecord>();
  if (productIds.length) {
    const { data, error: productError } = await supabase
      .from("productos").select("id, codigo, nombre, iva_alicuota_id")
      .in("id", productIds).eq("tenant_id", tenantId);
    if (productError) throw new Error("No se pudieron resolver los productos");
    (data ?? []).forEach((item) => products.set(text(record(item).id), record(item)));
  }
  const lineas: FacturaLinea[] = [];
  for (const value of rows ?? []) {
    const row = record(value);
    const stock = stockMap.get(text(row.stock_id)) ?? {};
    const product = products.get(text(stock.producto_id)) ?? {};
    appendLine(lineas, {
      origen,
      sourceId: text(row.id),
      descripcion: text(product.nombre) || (origen === "VENTA" ? "Producto" : "Repuesto"),
      codigo: nullable(product.codigo),
      cantidad: number(row.cantidad),
      importeUnitario: number(row.monto_unitario),
      ivaAlicuotaId: number(row.iva_alicuota_id ?? product.iva_alicuota_id, 5),
      snapshot: { ...row, producto: product },
    });
  }
  return lineas;
}

async function getCanonicalArreglo(tenantId: string, arregloId: string): Promise<CanonicalSource> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arreglos").select("id, vehiculo_id, fecha, precio_final")
    .eq("id", arregloId).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Arreglo no encontrado");
  const repair = record(data);
  const { data: vehicle } = await supabase.from("vehiculos").select("cliente_id").eq("id", text(repair.vehiculo_id)).maybeSingle();
  const clienteId = nullable(record(vehicle).cliente_id);
  if (!clienteId) throw new FacturacionValidationError("El vehículo no tiene un cliente asociado");
  const [{ data: services, error: serviceError }, { data: forms, error: formError }, assignments] = await Promise.all([
    supabase.from("detalle_arreglo").select("id, descripcion, cantidad, valor, iva_alicuota_id, created_at")
      .eq("arreglo_id", arregloId).eq("tenant_id", tenantId).order("created_at"),
    supabase.from("detalle_form_custom").select("id, costo, metadata, config_id, created_at")
      .eq("arreglo_id", arregloId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1),
    supabase.from("operaciones_asignacion_arreglo").select("operacion_id").eq("arreglo_id", arregloId),
  ]);
  if (serviceError || formError || assignments.error) throw new Error("No se pudo cargar el detalle del arreglo");
  const lineas: FacturaLinea[] = [];
  for (const value of services ?? []) {
    const row = record(value);
    appendLine(lineas, {
      origen: "SERVICIO", sourceId: text(row.id), descripcion: text(row.descripcion),
      cantidad: number(row.cantidad), importeUnitario: number(row.valor),
      ivaAlicuotaId: number(row.iva_alicuota_id, 5), snapshot: row,
    });
  }
  const form = record(forms?.[0]);
  if (number(form.costo) > 0) {
    appendLine(lineas, {
      origen: "FORMULARIO", sourceId: text(form.id), descripcion: "Cargo de formulario del arreglo",
      cantidad: 1, importeUnitario: number(form.costo), ivaAlicuotaId: 5, snapshot: form,
    });
  }
  const assignedIds = (assignments.data ?? []).map((row) => text(record(row).operacion_id)).filter(Boolean);
  if (assignedIds.length) {
    const { data: validOperations, error: operationError } = await supabase
      .from("operaciones").select("id").in("id", assignedIds).eq("tenant_id", tenantId).eq("tipo", "ASIGNACION_ARREGLO");
    if (operationError) throw new Error("No se pudieron validar las asignaciones");
    const repuestos = await resolveStockLines(tenantId, (validOperations ?? []).map((row) => text(record(row).id)), "REPUESTO");
    repuestos.forEach((line) => lineas.push({ ...line, ordinal: lineas.length + 1 }));
  }
  return {
    id: text(repair.id), origenTipo: "ARREGLO", fecha: nullable(repair.fecha),
    total: number(repair.precio_final), receptor: await getClientProfile(tenantId, clienteId), lineas,
  };
}

async function getCanonicalVenta(tenantId: string, operationId: string): Promise<CanonicalSource> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operaciones").select("id, tipo, fecha, cliente_id")
    .eq("id", operationId).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Venta no encontrada");
  const operation = record(data);
  if (text(operation.tipo) !== "VENTA") throw new FacturacionValidationError("Sólo una venta puede facturarse desde Operaciones");
  const lineas = await resolveStockLines(tenantId, [operationId], "VENTA");
  const total = lineas.reduce((sum, line) => sum + line.subtotal, 0);
  return {
    id: text(operation.id), origenTipo: "VENTA", fecha: nullable(operation.fecha), total,
    receptor: await getClientProfile(tenantId, nullable(operation.cliente_id)), lineas,
  };
}

async function getCanonicalSource(tenantId: string, tipo: FacturaOrigenTipo, id: string) {
  return tipo === "ARREGLO" ? getCanonicalArreglo(tenantId, id) : getCanonicalVenta(tenantId, id);
}

function sourceDate(value: string | null) {
  if (!value) return toIsoDate(new Date());
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? toIsoDate(new Date()) : toIsoDate(parsed);
}

function defaultFechas(source: CanonicalSource, concepto: 1 | 2 | 3): FacturaFechaInput {
  const today = toIsoDate(new Date());
  return concepto === 1 ? { fechaComprobante: today } : {
    fechaComprobante: today, fechaServicioDesde: sourceDate(source.fecha),
    fechaServicioHasta: today, fechaVencimientoPago: today,
  };
}

function mapSummary(value: unknown): FacturaElectronicaResumen {
  const row = record(value);
  const receiver = record(row.receptor_snapshot);
  const origenTipo: FacturaOrigenTipo = text(row.origen_tipo) === "VENTA" ? "VENTA" : "ARREGLO";
  return {
    id: text(row.id),
    estado: (text(row.estado) || "BORRADOR") as FacturaElectronicaResumen["estado"],
    ambiente: parseAmbiente(row.ambiente),
    origenTipo,
    origenId: text(origenTipo === "ARREGLO" ? row.arreglo_id : row.operacion_id),
    documentoTipo: (text(row.documento_tipo) || "FACTURA") as DocumentoFiscalClase,
    claseComprobante: (text(row.clase_comprobante) || "C") as FacturaElectronicaResumen["claseComprobante"],
    tipoComprobante: number(row.tipo_comprobante, 11),
    puntoVenta: number(row.punto_venta),
    numeroComprobante: row.numero_comprobante == null ? null : number(row.numero_comprobante),
    cae: nullable(row.cae), caeVencimiento: nullable(row.cae_vencimiento),
    total: number(row.total), concepto: number(row.concepto, 1) as 1 | 2 | 3,
    fechaComprobante: text(row.fecha_comprobante),
    receptorNombre: text(receiver.nombre) || "Consumidor final",
    receptorDocumento: nullable(receiver.numeroDocumento),
    createdAt: nullable(row.created_at) ?? undefined,
    errorCodigo: nullable(row.error_codigo), errorMensaje: nullable(row.error_mensaje),
  };
}

async function latestSourceInvoice(
  tenantId: string, tipo: FacturaOrigenTipo, id: string,
  ambiente: FacturacionAmbiente, documentoTipo: DocumentoFiscalClase = "FACTURA",
) {
  const supabase = await createClient();
  let query = supabase.from("facturas_electronicas").select("*")
    .eq("tenant_id", tenantId).eq("ambiente", ambiente).eq("documento_tipo", documentoTipo)
    .order("created_at", { ascending: false }).limit(1);
  query = tipo === "ARREGLO" ? query.eq("arreglo_id", id) : query.eq("operacion_id", id);
  const { data, error } = await query;
  if (error) throw new Error("No se pudo consultar el estado fiscal del origen");
  return data?.[0] ? record(data[0]) : null;
}

export async function getDocumentoPreflight(
  actor: TenantActor,
  origenTipo: FacturaOrigenTipo,
  origenId: string,
  ambiente: FacturacionAmbiente = "HOMOLOGACION",
): Promise<{ factura: FacturaElectronicaResumen | null; preflight: FacturacionPreflight }> {
  const [config, source, existing] = await Promise.all([
    getStoredConfig(actor.tenantId, ambiente),
    getCanonicalSource(actor.tenantId, origenTipo, origenId),
    latestSourceInvoice(actor.tenantId, origenTipo, origenId, ambiente),
  ]);
  let concepto: 1 | 2 | 3 = 1;
  let lineas = source.lineas;
  let totales = { netoGravado: 0, noGravado: 0, exento: 0, iva: 0, tributos: 0, otrosImpuestosNacionales: 0, total: source.total };
  let diferenciasTotal = false;
  let mensaje: string | undefined;
  try {
    concepto = deriveFacturaConcepto(source.lineas);
    validateLineasYTotal(source.lineas, source.total);
    const fiscal = fiscalizeLineas(source.lineas, config?.condicionIvaEmisor ?? "MONOTRIBUTISTA");
    lineas = fiscal.lineas;
    totales = fiscal.totales;
  } catch (error) {
    diferenciasTotal = true;
    mensaje = error instanceof Error ? error.message : "No se pudo validar el detalle fiscal";
  }
  const voucher = determineVoucher(config?.condicionIvaEmisor ?? "MONOTRIBUTISTA", source.receptor.condicionIvaReceptorId ?? 5);
  const factura = existing ? mapSummary(existing) : null;
  const fceBloqueada = Boolean(source.receptor.fceMipymeAlcanzado
    && (!config?.fceMontoMinimo || source.total >= config.fceMontoMinimo));
  if (!mensaje && (!config || !config.habilitada)) mensaje = `Falta configurar o habilitar ${ambiente.toLowerCase()}`;
  if (!mensaje && fceBloqueada) mensaje = "El receptor requiere FCE MiPyME, todavía no soportada";
  if (!mensaje && factura?.estado === "AUTORIZADA") mensaje = "El origen ya posee una factura autorizada";
  if (!mensaje && (factura?.estado === "ENVIANDO" || factura?.estado === "INCIERTA")) mensaje = "Existe una emisión pendiente de reconciliación";
  return {
    factura,
    preflight: {
      puedeEmitir: Boolean(config?.habilitada) && !diferenciasTotal
        && !fceBloqueada && (!factura || factura.estado === "RECHAZADA"),
      configuracionCompleta: Boolean(config?.habilitada), origenListo: !diferenciasTotal,
      diferenciasTotal, fceBloqueada, mensaje,
      emisor: config ? {
        razonSocial: config.razonSocial, cuit: config.cuit, puntoVenta: config.puntoVenta,
        ambiente: config.ambiente, condicionIvaEmisor: config.condicionIvaEmisor,
      } : undefined,
      receptor: source.receptor, concepto, documentoTipo: "FACTURA",
      claseComprobante: voucher.clase, tipoComprobante: voucher.tipo,
      lineas, totales, total: totales.total, precioFinal: source.total,
      fechasDefault: defaultFechas(source, concepto),
    },
  };
}

export function getFacturaPreflight(actor: TenantActor, id: string, ambiente?: FacturacionAmbiente) {
  return getDocumentoPreflight(actor, "ARREGLO", id, ambiente);
}

export function getVentaFacturaPreflight(actor: TenantActor, id: string, ambiente?: FacturacionAmbiente) {
  return getDocumentoPreflight(actor, "VENTA", id, ambiente);
}

export function parseFacturaIssueInput(value: unknown): FacturaIssueInput {
  const row = record(value);
  const receiver = record(row.receptor);
  const dates = record(row.fechas);
  const condicionVenta = text(row.condicionVenta) || "CONTADO";
  if (condicionVenta.length > 80) {
    throw new FacturacionValidationError("La condición de venta no puede superar los 80 caracteres");
  }
  return {
    idempotencyKey: assertUuid(row.idempotencyKey, "La clave de idempotencia"),
    ambiente: parseAmbiente(row.ambiente),
    condicionVenta,
    receptor: {
      tipoDocumento: parseDocumento(receiver.tipoDocumento),
      numeroDocumento: nullable(receiver.numeroDocumento),
      condicionIvaReceptorId: parseCondicion(receiver.condicionIvaReceptorId),
    },
    fechas: {
      fechaComprobante: text(dates.fechaComprobante),
      fechaServicioDesde: nullable(dates.fechaServicioDesde),
      fechaServicioHasta: nullable(dates.fechaServicioHasta),
      fechaVencimientoPago: nullable(dates.fechaVencimientoPago),
    },
  };
}

function emitterSnapshot(config: StoredConfig) {
  return {
    razonSocial: config.razonSocial, nombreFantasia: config.nombreFantasia,
    cuit: config.cuit, domicilio: config.domicilio, ingresosBrutos: config.ingresosBrutos,
    inicioActividades: config.inicioActividades, condicionIvaEmisor: config.condicionIvaEmisor,
    condicionIva: config.condicionIvaEmisor === "RESPONSABLE_INSCRIPTO"
      ? "Responsable inscripto" : "Monotributista",
  };
}

function receiverSnapshot(receiver: PerfilFiscalCliente) {
  const document = validateDocument(receiver.tipoDocumento, receiver.numeroDocumento);
  if (!receiver.condicionIvaReceptorId) throw new FacturacionValidationError("La condición IVA es obligatoria");
  return {
    clienteId: receiver.clienteId, nombre: receiver.nombre, domicilio: receiver.domicilio,
    tipoDocumento: document.tipoDocumento, numeroDocumento: document.numeroDocumento,
    condicionIvaReceptorId: receiver.condicionIvaReceptorId,
  };
}

async function saveFiscalProfile(tenantId: string, receiver: PerfilFiscalCliente) {
  if (!receiver.clienteId) return;
  const document = validateDocument(receiver.tipoDocumento, receiver.numeroDocumento);
  if (!receiver.condicionIvaReceptorId) throw new FacturacionValidationError("La condición IVA es obligatoria");
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({
    tipo_documento_fiscal: document.tipoDocumento === 99 ? null : document.tipoDocumento,
    numero_documento_fiscal: document.tipoDocumento === 99 ? null : document.numeroDocumento,
    condicion_iva_receptor_id: receiver.condicionIvaReceptorId,
  }).eq("id", receiver.clienteId).eq("tenant_id", tenantId);
  if (error) throw new Error("No se pudo guardar el perfil fiscal del cliente");
  if (document.tipoDocumento === 80) {
    await supabase.from("empresas").update({ cuit: document.numeroDocumento }).eq("id", receiver.clienteId);
  }
}

async function identificationThreshold(date: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturacion_parametros_normativos")
    .select("valor_numerico")
    .eq("clave", "CONSUMIDOR_FINAL_IDENTIFICACION")
    .lte("vigente_desde", date)
    .order("vigente_desde", { ascending: false }).limit(1);
  if (error) throw new Error("No se pudo cargar el parámetro de identificación de consumidor final");
  return number(data?.[0]?.valor_numerico, 10_000_000);
}

function candidateMatches(candidate: DbRecord, info: DbRecord) {
  return number(info.ImpTotal, Number.NaN) === number(candidate.ImpTotal, Number.NaN)
    && number(info.DocTipo, Number.NaN) === number(candidate.DocTipo, Number.NaN)
    && number(info.DocNro, Number.NaN) === number(candidate.DocNro, Number.NaN)
    && text(info.CbteFch) === text(candidate.CbteFch);
}

function arcaDateToIso(value: unknown): string | null {
  const compact = text(value).replace(/\D/g, "");
  return /^\d{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}` : null;
}

function errorDetails(error: unknown) {
  const row = record(error);
  const response = record(row.response);
  const status = number(response.status, 0);
  const code = nullable(row.code) ?? nullable(response.status);
  const responseData = record(response.data);
  const rawArcaErrors = responseData.Errors ?? row.Errors ?? row.errors;
  const arcaErrors = Array.isArray(rawArcaErrors)
    ? rawArcaErrors
    : Object.values(record(rawArcaErrors));
  const firstArcaError = record(arcaErrors[0]);
  const message = (
    nullable(firstArcaError.Msg)
    ?? nullable(firstArcaError.message)
    ?? (error instanceof Error ? error.message : "Error desconocido al emitir")
  ).slice(0, 1000);
  return {
    code: nullable(firstArcaError.Code) ?? nullable(firstArcaError.code) ?? code,
    message,
    rejected: arcaErrors.length > 0 || status === 400 || status === 422,
  };
}

async function lease(config: StoredConfig, tipo: number, token: string, acquire: boolean) {
  const supabase = await createClient();
  const functionName = acquire ? "rpc_facturacion_adquirir_lease" : "rpc_facturacion_liberar_lease";
  const { data, error } = await supabase.rpc(functionName, {
    p_emisor_cuit: config.cuit, p_punto_venta: config.puntoVenta,
    p_tipo_comprobante: tipo, p_lease_token: token, ...(acquire ? { p_segundos: 120 } : {}),
  });
  if (error && acquire) throw new Error("No se pudo adquirir la exclusión de emisión fiscal");
  return acquire ? data === true : true;
}

type EmitDocumentInput = {
  actor: TenantActor;
  source: CanonicalSource;
  config: StoredConfig;
  documentType: DocumentoFiscalClase;
  idempotencyKey: string;
  receiver: PerfilFiscalCliente;
  dates: FacturaFechaInput;
  condition: string;
  lines: FacturaLinea[];
  associated?: DbRecord | null;
  retry?: DbRecord | null;
};

async function emitDocument(input: EmitDocumentInput): Promise<FacturaIssueResult> {
  const supabase = await createClient();
  validateDocument(input.receiver.tipoDocumento, input.receiver.numeroDocumento);
  if (!input.receiver.condicionIvaReceptorId) throw new FacturacionValidationError("La condición IVA es obligatoria");
  const concept = deriveFacturaConcepto(input.lines);
  const dates = validateFechas(concept, input.dates);
  const fiscal = fiscalizeLineas(input.lines, input.config.condicionIvaEmisor);
  const voucher = determineVoucher(input.config.condicionIvaEmisor, input.receiver.condicionIvaReceptorId, input.documentType);
  const token = randomUUID();
  if (!(await lease(input.config, voucher.tipo, token, true))) {
    throw new FacturacionValidationError("Hay otra emisión en curso para el punto de venta");
  }
  try {
    const gateway = await createGateway(input.config);
    const candidateNumber = (await gateway.getLastVoucher(input.config.puntoVenta, voucher.tipo)) + 1;
    const payload = buildComprobantePayload({
      voucherNumber: candidateNumber, puntoVenta: input.config.puntoVenta,
      tipoComprobante: voucher.tipo, claseComprobante: voucher.clase,
      concepto: concept, receptor: input.receiver, fechas: dates,
      totales: fiscal.totales, lineas: fiscal.lineas,
      asociado: input.associated ? {
        tipo: number(input.associated.tipo_comprobante),
        puntoVenta: number(input.associated.punto_venta),
        numero: number(input.associated.numero_comprobante),
      } : null,
    });
    const emitter = emitterSnapshot(input.config);
    const receiver = receiverSnapshot(input.receiver);
    const contentHash = createHash("sha256").update(JSON.stringify({
      source: input.source.id, documentType: input.documentType, emitter, receiver,
      dates, condition: input.condition, lines: fiscal.lineas, totals: fiscal.totales,
    })).digest("hex");
    const header = {
      tenant_id: input.actor.tenantId,
      arreglo_id: input.source.origenTipo === "ARREGLO" ? input.source.id : null,
      operacion_id: input.source.origenTipo === "VENTA" ? input.source.id : null,
      origen_tipo: input.source.origenTipo,
      documento_tipo: input.documentType,
      documento_asociado_id: input.associated ? text(input.associated.id) : null,
      idempotency_key: input.idempotencyKey,
      ambiente: input.config.ambiente,
      emisor_snapshot: emitter,
      receptor_snapshot: receiver,
      concepto: concept,
      fecha_comprobante: dates.fechaComprobante,
      fecha_servicio_desde: concept === 1 ? null : dates.fechaServicioDesde,
      fecha_servicio_hasta: concept === 1 ? null : dates.fechaServicioHasta,
      fecha_vencimiento_pago: concept === 1 ? null : dates.fechaVencimientoPago,
      total: fiscal.totales.total,
      punto_venta: input.config.puntoVenta,
      tipo_comprobante: voucher.tipo,
      clase_comprobante: voucher.clase,
      numero_comprobante: candidateNumber,
      condicion_venta: input.condition,
      importe_neto_gravado: fiscal.totales.netoGravado,
      importe_no_gravado: fiscal.totales.noGravado,
      importe_exento: fiscal.totales.exento,
      importe_iva: fiscal.totales.iva,
      importe_tributos: fiscal.totales.tributos,
      otros_impuestos_nacionales: fiscal.totales.otrosImpuestosNacionales,
      contenido_hash: contentHash,
      created_by: input.actor.userId,
    };
    const dbLines = fiscal.lineas.map((line) => ({
      ordinal: line.ordinal, origen: line.origen, source_id: line.sourceId || null,
      descripcion: line.descripcion, codigo: line.codigo || null, cantidad: line.cantidad,
      importe_unitario: line.importeUnitario, subtotal: line.subtotal,
      tratamiento_iva: line.tratamientoIva, iva_alicuota_id: line.ivaAlicuotaId,
      iva_alicuota: line.ivaAlicuota, importe_neto: line.importeNeto,
      importe_iva: line.importeIva, importe_total: line.importeTotal,
      snapshot: line.snapshot ?? {},
    }));
    const { data: invoiceId, error: prepareError } = await supabase.rpc("rpc_facturacion_preparar_documento", {
      p_encabezado: header, p_lineas: dbLines,
      p_factura_id: input.retry ? text(input.retry.id) : null,
    });
    if (prepareError || !invoiceId) throw new Error("No se pudo preparar el documento fiscal");
    const { count } = await supabase.from("facturacion_emision_intentos")
      .select("id", { count: "exact", head: true }).eq("factura_id", invoiceId);
    const { data: attempt, error: attemptError } = await supabase.from("facturacion_emision_intentos")
      .insert({
        factura_id: invoiceId, numero_intento: (count ?? 0) + 1, estado: "ENVIADO",
        candidato: { numero: candidateNumber, ...payload }, request_sanitizado: sanitizeFiscalPayload(payload),
      }).select("id").single();
    if (attemptError || !attempt) throw new Error("No se pudo registrar el intento fiscal");

    const authorize = async (response: DbRecord, recovered = false) => {
      const cae = nullable(response.CAE) ?? nullable(response.CodAutorizacion);
      const expiration = arcaDateToIso(response.CAEFchVto) ?? arcaDateToIso(response.FchVto) ?? text(response.CAEFchVto);
      if (!cae || !/^\d{14}$/.test(cae) || !expiration || !isIsoDate(expiration)) {
        throw new Error("ARCA no devolvió un CAE válido y el comprobante debe reconciliarse");
      }
      const { data, error } = await supabase.from("facturas_electronicas").update({
        estado: "AUTORIZADA", cae, cae_vencimiento: expiration,
        autorizada_at: new Date().toISOString(), error_codigo: null, error_mensaje: null,
      }).eq("id", invoiceId).select("*").single();
      if (error || !data) throw new Error("ARCA autorizó el documento pero no se pudo persistir");
      await supabase.from("facturacion_emision_intentos").update({
        estado: "AUTORIZADO", response_sanitizada: sanitizeFiscalPayload(response),
        completed_at: new Date().toISOString(),
      }).eq("id", record(attempt).id);
      return { invoice: mapSummary(data), httpStatus: 201, message: recovered ? "Documento reconciliado mediante consulta a ARCA" : undefined };
    };

    try {
      return await authorize(record(await gateway.createVoucher(payload)));
    } catch (cause) {
      try {
        const info = await gateway.getVoucherInfo(candidateNumber, input.config.puntoVenta, voucher.tipo);
        if (info && candidateMatches(record(payload), record(info))) return await authorize(record(info), true);
      } catch {
        // Se preserva INCIERTA cuando ARCA no puede confirmar el candidato.
      }
      const detail = errorDetails(cause);
      const state = detail.rejected ? "RECHAZADA" : "INCIERTA";
      const { data, error } = await supabase.from("facturas_electronicas").update({
        estado: state, error_codigo: detail.code, error_mensaje: detail.message,
      }).eq("id", invoiceId).select("*").single();
      if (error || !data) throw new Error("No se pudo persistir el resultado fiscal");
      await supabase.from("facturacion_emision_intentos").update({
        estado: state === "RECHAZADA" ? "RECHAZADO" : "INCIERTO",
        response_sanitizada: sanitizeFiscalPayload(record(cause).response),
        error_codigo: detail.code, error_mensaje: detail.message, completed_at: new Date().toISOString(),
      }).eq("id", record(attempt).id);
      return { invoice: mapSummary(data), httpStatus: state === "RECHAZADA" ? 422 : 409, message: detail.message };
    }
  } finally {
    await lease(input.config, determineVoucher(input.config.condicionIvaEmisor, input.receiver.condicionIvaReceptorId, input.documentType).tipo, token, false);
  }
}

async function issueSourceFactura(
  actor: TenantActor,
  origenTipo: FacturaOrigenTipo,
  origenId: string,
  input: FacturaIssueInput,
): Promise<FacturaIssueResult> {
  const config = await getStoredConfig(actor.tenantId, input.ambiente);
  if (!config?.habilitada) throw new FacturacionValidationError("La configuración fiscal está incompleta o deshabilitada");
  const source = await getCanonicalSource(actor.tenantId, origenTipo, origenId);
  validateLineasYTotal(source.lineas, source.total);
  validateFechas(deriveFacturaConcepto(source.lineas), input.fechas);
  const receiver = { ...source.receptor, ...input.receptor };
  const document = validateDocument(receiver.tipoDocumento, receiver.numeroDocumento);
  if (document.tipoDocumento === 99 && source.total >= await identificationThreshold(input.fechas.fechaComprobante)) {
    throw new FacturacionValidationError("Por el monto del comprobante debe identificar al consumidor final");
  }
  if (receiver.fceMipymeAlcanzado && (!config.fceMontoMinimo || source.total >= config.fceMontoMinimo)) {
    throw new FacturacionValidationError("El receptor requiere Factura de Crédito Electrónica MiPyME");
  }
  const supabase = await createClient();
  const { data: idempotent } = await supabase.from("facturas_electronicas").select("*")
    .eq("tenant_id", actor.tenantId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (idempotent) {
    const summary = mapSummary(idempotent);
    return { invoice: summary, httpStatus: summary.estado === "AUTORIZADA" ? 200 : 409 };
  }
  const existing = await latestSourceInvoice(actor.tenantId, origenTipo, origenId, input.ambiente);
  if (existing && text(existing.estado) !== "RECHAZADA") {
    const summary = mapSummary(existing);
    return {
      invoice: summary, httpStatus: summary.estado === "AUTORIZADA" ? 200 : 409,
      message: summary.estado === "AUTORIZADA" ? undefined : "La emisión debe reconciliarse antes de reintentar",
    };
  }
  await saveFiscalProfile(actor.tenantId, receiver);
  return emitDocument({
    actor, source, config, documentType: "FACTURA", idempotencyKey: input.idempotencyKey,
    receiver, dates: input.fechas, condition: input.condicionVenta,
    lines: source.lineas, retry: existing,
  });
}

export function issueFacturaElectronica(actor: TenantActor, id: string, input: FacturaIssueInput) {
  return issueSourceFactura(actor, "ARREGLO", id, input);
}

export function issueVentaElectronica(actor: TenantActor, id: string, input: FacturaIssueInput) {
  return issueSourceFactura(actor, "VENTA", id, input);
}

export async function reconcileFactura(actor: TenantActor, facturaId: string): Promise<FacturaElectronicaResumen> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facturas_electronicas").select("*")
    .eq("id", facturaId).eq("tenant_id", actor.tenantId).maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Documento fiscal no encontrado");
  const invoice = record(data);
  if (text(invoice.estado) === "AUTORIZADA") return mapSummary(invoice);
  if (!['ENVIANDO', 'INCIERTA'].includes(text(invoice.estado))) {
    throw new FacturacionValidationError("Sólo se pueden reconciliar emisiones enviadas o inciertas");
  }
  const config = await getStoredConfig(actor.tenantId, parseAmbiente(invoice.ambiente));
  if (!config) throw new FacturacionValidationError("No existe la configuración del ambiente del documento");
  const gateway = await createGateway(config);
  const info = await gateway.getVoucherInfo(number(invoice.numero_comprobante), number(invoice.punto_venta), number(invoice.tipo_comprobante));
  const receiver = record(invoice.receptor_snapshot);
  const candidate = {
    ImpTotal: number(invoice.total), DocTipo: number(receiver.tipoDocumento),
    DocNro: number(receiver.numeroDocumento), CbteFch: text(invoice.fecha_comprobante).replaceAll("-", ""),
  };
  if (!info || !candidateMatches(candidate, record(info))) {
    throw new FacturacionValidationError("ARCA todavía no confirma el comprobante candidato");
  }
  const cae = nullable(record(info).CodAutorizacion) ?? nullable(record(info).CAE);
  const expiration = arcaDateToIso(record(info).FchVto) ?? arcaDateToIso(record(info).CAEFchVto);
  if (!cae || !/^\d{14}$/.test(cae) || !expiration || !isIsoDate(expiration)) {
    throw new FacturacionValidationError("ARCA devolvió el comprobante sin un CAE vigente válido");
  }
  const { data: updated, error: updateError } = await supabase.from("facturas_electronicas").update({
    estado: "AUTORIZADA", cae,
    cae_vencimiento: expiration,
    autorizada_at: new Date().toISOString(), error_codigo: null, error_mensaje: null,
  }).eq("id", facturaId).select("*").single();
  if (updateError || !updated) throw new Error("No se pudo reconciliar el documento localmente");
  const { count } = await supabase.from("facturacion_emision_intentos")
    .select("id", { count: "exact", head: true }).eq("factura_id", facturaId);
  await supabase.from("facturacion_emision_intentos").insert({
    factura_id: facturaId, numero_intento: (count ?? 0) + 1, estado: "AUTORIZADO",
    candidato: { ...candidate, reconciliacion: true }, response_sanitizada: sanitizeFiscalPayload(info),
    completed_at: new Date().toISOString(),
  });
  return mapSummary(updated);
}

export function parseNotaInput(value: unknown) {
  const row = record(value);
  const tipo = text(row.tipo);
  if (tipo !== "NOTA_CREDITO" && tipo !== "NOTA_DEBITO") throw new FacturacionValidationError("Tipo de nota inválido");
  const importe = number(row.importe);
  if (importe <= 0) throw new FacturacionValidationError("El importe de la nota debe ser positivo");
  const motivo = text(row.motivo) || (tipo === "NOTA_CREDITO" ? "Anulación / ajuste" : "Ajuste de débito");
  if (motivo.length > 200) throw new FacturacionValidationError("El motivo no puede superar los 200 caracteres");
  return {
    tipo: tipo as "NOTA_CREDITO" | "NOTA_DEBITO", importe,
    motivo,
    idempotencyKey: assertUuid(row.idempotencyKey, "La clave de idempotencia"),
  };
}

function proportionalLines(lines: FacturaLinea[], amount: number, reason: string): FacturaLinea[] {
  const target = amountToCents(amount);
  const sourceTotal = lines.reduce((sum, line) => sum + amountToCents(line.subtotal), 0);
  let assigned = 0;
  return lines.map((line, index) => {
    const cents = index === lines.length - 1
      ? target - assigned
      : Math.round(target * amountToCents(line.subtotal) / sourceTotal);
    assigned += cents;
    const value = centsToAmount(cents);
    return {
      ...line, ordinal: index + 1, origen: "AJUSTE" as const, sourceId: null,
      descripcion: `${reason}: ${line.descripcion}`, cantidad: 1,
      importeUnitario: value, subtotal: value, snapshot: { lineaOriginal: line.snapshot ?? {} },
    };
  }).filter((line) => line.subtotal > 0);
}

export async function issueNotaFiscal(
  actor: TenantActor,
  facturaId: string,
  input: ReturnType<typeof parseNotaInput>,
): Promise<FacturaIssueResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facturas_electronicas").select("*")
    .eq("id", facturaId).eq("tenant_id", actor.tenantId).maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Factura original no encontrada");
  const original = record(data);
  if (text(original.estado) !== "AUTORIZADA" || text(original.documento_tipo) !== "FACTURA") {
    throw new FacturacionValidationError("La nota debe asociarse a una factura autorizada");
  }
  const { data: idempotent, error: idempotencyError } = await supabase.from("facturas_electronicas")
    .select("*").eq("tenant_id", actor.tenantId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (idempotencyError) throw new Error("No se pudo verificar la idempotencia de la nota");
  let retry: DbRecord | null = null;
  if (idempotent) {
    const previous = record(idempotent);
    if (text(previous.documento_asociado_id) !== facturaId || text(previous.documento_tipo) !== input.tipo) {
      throw new FacturacionValidationError("La clave de idempotencia ya pertenece a otro documento fiscal");
    }
    const summary = mapSummary(previous);
    if (summary.estado !== "RECHAZADA") {
      return {
        invoice: summary,
        httpStatus: summary.estado === "AUTORIZADA" ? 200 : 409,
        message: summary.estado === "AUTORIZADA" ? undefined : "La nota debe reconciliarse antes de reintentar",
      };
    }
    retry = previous;
  }
  const { data: adjustments } = await supabase.from("facturas_electronicas")
    .select("documento_tipo,total").eq("documento_asociado_id", facturaId)
    .eq("tenant_id", actor.tenantId).eq("estado", "AUTORIZADA");
  const credit = (adjustments ?? []).filter((row) => text(record(row).documento_tipo) === "NOTA_CREDITO")
    .reduce((sum, row) => sum + number(record(row).total), 0);
  const debit = (adjustments ?? []).filter((row) => text(record(row).documento_tipo) === "NOTA_DEBITO")
    .reduce((sum, row) => sum + number(record(row).total), 0);
  if (input.tipo === "NOTA_CREDITO" && input.importe > number(original.total) + debit - credit + 0.001) {
    throw new FacturacionValidationError("La nota de crédito supera el saldo fiscal disponible");
  }
  const config = await getStoredConfig(actor.tenantId, parseAmbiente(original.ambiente));
  if (!config?.habilitada) throw new FacturacionValidationError("La configuración del ambiente no está habilitada");
  const originalEmitter = record(original.emisor_snapshot);
  if (normalizeDocumentNumber(originalEmitter.cuit as string) !== config.cuit) {
    throw new FacturacionValidationError("El CUIT configurado ya no coincide con el emisor de la factura original");
  }
  const { data: rawLines, error: lineError } = await supabase.from("facturas_electronicas_lineas")
    .select("*").eq("factura_id", facturaId).order("ordinal");
  if (lineError || !rawLines?.length) throw new Error("No se pudo cargar el detalle de la factura original");
  const originalLines = rawLines.map(mapLine);
  const source: CanonicalSource = {
    id: text(original.origen_tipo) === "VENTA" ? text(original.operacion_id) : text(original.arreglo_id),
    origenTipo: text(original.origen_tipo) === "VENTA" ? "VENTA" : "ARREGLO",
    fecha: text(original.fecha_comprobante), total: input.importe,
    receptor: profileFromSnapshot(record(original.receptor_snapshot)),
    lineas: proportionalLines(originalLines, input.importe, input.motivo),
  };
  const noteVoucher = determineVoucher(config.condicionIvaEmisor, source.receptor.condicionIvaReceptorId, input.tipo);
  if (noteVoucher.clase !== text(original.clase_comprobante)) {
    throw new FacturacionValidationError("La condición IVA configurada ya no permite emitir una nota de la misma clase que la factura original");
  }
  const today = toIsoDate(new Date());
  const concept = number(original.concepto, 1) as 1 | 2 | 3;
  const dates: FacturaFechaInput = concept === 1 ? { fechaComprobante: today } : {
    fechaComprobante: today,
    fechaServicioDesde: nullable(original.fecha_servicio_desde) ?? today,
    fechaServicioHasta: nullable(original.fecha_servicio_hasta) ?? today,
    fechaVencimientoPago: today,
  };
  return emitDocument({
    actor, source, config, documentType: input.tipo, idempotencyKey: input.idempotencyKey,
    receiver: source.receptor, dates, condition: text(original.condicion_venta) || "CONTADO",
    lines: source.lineas, associated: original, retry,
  });
}

function mapLine(value: unknown): FacturaLinea {
  const row = record(value);
  return {
    ordinal: number(row.ordinal), origen: text(row.origen) as FacturaLinea["origen"],
    sourceId: nullable(row.source_id), descripcion: text(row.descripcion), codigo: nullable(row.codigo),
    cantidad: number(row.cantidad), importeUnitario: number(row.importe_unitario), subtotal: number(row.subtotal),
    tratamientoIva: (text(row.tratamiento_iva) || "GRAVADO") as FacturaLinea["tratamientoIva"],
    ivaAlicuotaId: row.iva_alicuota_id == null ? null : number(row.iva_alicuota_id),
    ivaAlicuota: number(row.iva_alicuota), importeNeto: number(row.importe_neto),
    importeIva: number(row.importe_iva), importeTotal: number(row.importe_total),
    snapshot: record(row.snapshot),
  };
}

function profileFromSnapshot(value: DbRecord): PerfilFiscalCliente {
  return {
    clienteId: nullable(value.clienteId), nombre: text(value.nombre) || "Consumidor final",
    domicilio: nullable(value.domicilio), tipoDocumento: parseDocumento(value.tipoDocumento),
    numeroDocumento: nullable(value.numeroDocumento), condicionIvaReceptorId: parseCondicion(value.condicionIvaReceptorId),
  };
}

export async function listFacturas(tenantId: string, filters: FacturasListFilters = {}): Promise<FacturasPaginadas> {
  const page = Math.max(1, Math.trunc(number(filters.page, 1)));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(number(filters.pageSize, 25))));
  if (filters.estado && !["BORRADOR", "LISTA", "ENVIANDO", "AUTORIZADA", "RECHAZADA", "INCIERTA"].includes(filters.estado)) {
    throw new FacturacionValidationError("El estado del filtro no es válido");
  }
  if (filters.ambiente && filters.ambiente !== "HOMOLOGACION" && filters.ambiente !== "PRODUCCION") {
    throw new FacturacionValidationError("El ambiente del filtro no es válido");
  }
  if (filters.documentoTipo && !["FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"].includes(filters.documentoTipo)) {
    throw new FacturacionValidationError("El tipo de documento del filtro no es válido");
  }
  if ((filters.desde && !isIsoDate(filters.desde)) || (filters.hasta && !isIsoDate(filters.hasta))) {
    throw new FacturacionValidationError("Las fechas del filtro deben tener formato AAAA-MM-DD");
  }
  if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
    throw new FacturacionValidationError("La fecha desde no puede ser posterior a la fecha hasta");
  }
  const from = (page - 1) * pageSize;
  const supabase = await createClient();
  let query = supabase.from("facturas_electronicas").select("*", { count: "exact" })
    .eq("tenant_id", tenantId).order("fecha_comprobante", { ascending: false })
    .order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (filters.estado) query = query.eq("estado", filters.estado);
  if (filters.ambiente) query = query.eq("ambiente", filters.ambiente);
  if (filters.documentoTipo) query = query.eq("documento_tipo", filters.documentoTipo);
  if (filters.desde) query = query.gte("fecha_comprobante", filters.desde);
  if (filters.hasta) query = query.lte("fecha_comprobante", filters.hasta);
  if (filters.search) {
    const search = filters.search.replace(/[%_,()]/g, "").trim();
    if (search.length > 100) throw new FacturacionValidationError("La búsqueda no puede superar los 100 caracteres");
    if (search) query = query.or(`cae.ilike.%${search}%,receptor_snapshot->>nombre.ilike.%${search}%,receptor_snapshot->>numeroDocumento.ilike.%${search}%`);
  }
  const { data, error, count } = await query;
  if (error) throw new Error("No se pudo listar los documentos fiscales");
  return { items: (data ?? []).map(mapSummary), page, pageSize, total: count ?? 0 };
}

export async function getFacturaDetalle(tenantId: string, facturaId: string): Promise<FacturaElectronicaDetalle> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facturas_electronicas").select("*")
    .eq("id", facturaId).eq("tenant_id", tenantId).maybeSingle();
  if (error || !data) throw new FacturacionValidationError("Documento fiscal no encontrado");
  const invoice = record(data);
  const [lines, attempts, associated, adjustments] = await Promise.all([
    supabase.from("facturas_electronicas_lineas").select("*").eq("factura_id", facturaId).order("ordinal"),
    supabase.from("facturacion_emision_intentos").select("*").eq("factura_id", facturaId).order("numero_intento"),
    invoice.documento_asociado_id
      ? supabase.from("facturas_electronicas").select("*")
        .eq("id", invoice.documento_asociado_id).eq("tenant_id", tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("facturas_electronicas").select("*")
      .eq("documento_asociado_id", facturaId).eq("tenant_id", tenantId).order("created_at"),
  ]);
  if (lines.error || attempts.error || associated.error || adjustments.error) {
    throw new Error("No se pudo cargar el detalle fiscal completo");
  }
  return {
    ...mapSummary(invoice),
    emisorSnapshot: record(invoice.emisor_snapshot), receptorSnapshot: record(invoice.receptor_snapshot),
    fechas: {
      fechaComprobante: text(invoice.fecha_comprobante),
      fechaServicioDesde: nullable(invoice.fecha_servicio_desde),
      fechaServicioHasta: nullable(invoice.fecha_servicio_hasta),
      fechaVencimientoPago: nullable(invoice.fecha_vencimiento_pago),
    },
    condicionVenta: text(invoice.condicion_venta) || "CONTADO", moneda: "PES",
    totales: {
      netoGravado: number(invoice.importe_neto_gravado), noGravado: number(invoice.importe_no_gravado),
      exento: number(invoice.importe_exento), iva: number(invoice.importe_iva),
      tributos: number(invoice.importe_tributos), otrosImpuestosNacionales: number(invoice.otros_impuestos_nacionales),
      total: number(invoice.total),
    },
    lineas: (lines.data ?? []).map(mapLine),
    documentoAsociado: associated.data ? mapSummary(associated.data) : null,
    documentosAjuste: (adjustments.data ?? []).map(mapSummary),
    intentos: (attempts.data ?? []).map((value) => {
      const row = record(value);
      return {
        id: text(row.id), numeroIntento: number(row.numero_intento), estado: text(row.estado),
        errorCodigo: nullable(row.error_codigo), errorMensaje: nullable(row.error_mensaje),
        createdAt: text(row.created_at), completedAt: nullable(row.completed_at),
      };
    }),
    origenExterno: invoice.origen_externo === true,
    pdfDisponible: Boolean(invoice.pdf_storage_path) || text(invoice.estado) === "AUTORIZADA",
  };
}

export async function exportFacturasRows(tenantId: string, filters: FacturasListFilters = {}) {
  const items: FacturaElectronicaResumen[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await listFacturas(tenantId, { ...filters, page, pageSize: 100 });
    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);

  return items.map((item) => ({
    fecha: item.fechaComprobante, comprobante: `${item.claseComprobante} ${item.puntoVenta}-${item.numeroComprobante ?? ""}`,
    tipo: item.documentoTipo, ambiente: item.ambiente, estado: item.estado,
    receptor: item.receptorNombre, documento: item.receptorDocumento ?? "",
    total: item.total, cae: item.cae ?? "", origen: item.origenTipo, origenId: item.origenId,
  }));
}

const PDF_TEMPLATE_VERSION = "fiscal-v2";
const PDF_BUCKET = "facturacion-comprobantes";

export async function buildFacturaPdf(tenantId: string, facturaId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const supabase = await createClient();
  const detail = await getFacturaDetalle(tenantId, facturaId);
  if (detail.estado !== "AUTORIZADA") throw new FacturacionValidationError("El PDF sólo está disponible para documentos autorizados");
  const { data: invoice } = await supabase.from("facturas_electronicas")
    .select("pdf_storage_path").eq("id", facturaId).eq("tenant_id", tenantId).single();
  const storedPath = nullable(record(invoice).pdf_storage_path);
  if (storedPath) {
    const downloaded = await supabase.storage.from(PDF_BUCKET).download(storedPath);
    if (!downloaded.error && downloaded.data) {
      return { bytes: new Uint8Array(await downloaded.data.arrayBuffer()), filename: pdfFilename(detail) };
    }
  }
  const fiscal: FiscalPdfInvoice = {
    id: detail.id, emisorSnapshot: detail.emisorSnapshot, receptorSnapshot: detail.receptorSnapshot,
    concepto: detail.concepto, fechaComprobante: detail.fechas.fechaComprobante,
    fechaServicioDesde: detail.fechas.fechaServicioDesde ?? null,
    fechaServicioHasta: detail.fechas.fechaServicioHasta ?? null,
    fechaVencimientoPago: detail.fechas.fechaVencimientoPago ?? null,
    total: detail.total, puntoVenta: detail.puntoVenta, tipoComprobante: detail.tipoComprobante,
    claseComprobante: detail.claseComprobante, documentoTipo: detail.documentoTipo,
    condicionVenta: detail.condicionVenta, totales: detail.totales,
    numeroComprobante: detail.numeroComprobante!, cae: detail.cae!, caeVencimiento: detail.caeVencimiento!,
    lineas: detail.lineas.map((line) => ({
      codigo: line.codigo ?? null, descripcion: line.descripcion, cantidad: line.cantidad,
      importeUnitario: line.importeUnitario, subtotal: line.subtotal,
    })),
  };
  const bytes = await generateFiscalInvoicePdf(fiscal);
  const path = `${tenantId}/${detail.ambiente.toLowerCase()}/${detail.id}/${PDF_TEMPLATE_VERSION}.pdf`;
  const uploaded = await supabase.storage.from(PDF_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (!uploaded.error) {
    await supabase.from("facturas_electronicas").update({
      pdf_storage_path: path,
      pdf_sha256: createHash("sha256").update(bytes).digest("hex"),
      pdf_template_version: PDF_TEMPLATE_VERSION,
    }).eq("id", facturaId).eq("tenant_id", tenantId);
  }
  return { bytes, filename: pdfFilename(detail) };
}

function pdfFilename(invoice: FacturaElectronicaResumen) {
  const kind = invoice.documentoTipo === "FACTURA" ? "factura"
    : invoice.documentoTipo === "NOTA_CREDITO" ? "nota-credito" : "nota-debito";
  return `${kind}-${invoice.claseComprobante.toLowerCase()}-${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante ?? 0).padStart(8, "0")}.pdf`;
}

export { FacturacionValidationError, normalizeDocumentNumber };
