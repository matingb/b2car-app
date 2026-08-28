import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/supabase/admin";
import {
  amountToCents,
  buildFacturaCPayload,
  centsToAmount,
  deriveFacturaConcepto,
  FacturacionValidationError,
  normalizeDocumentNumber,
  toIsoDate,
  validateDocument,
  validateFechas,
  validateLineasYTotal,
} from "./arcaPayload";
import { createArcaGateway, sanitizeFiscalPayload } from "./afipGateway";
import {
  deleteCredentialPair,
  downloadCredentialPair,
  uploadCredentialPair,
} from "./credentialStorage";
import { generateFiscalInvoicePdf, type FiscalPdfInvoice } from "./fiscalPdf";
import {
  CONDICIONES_IVA_RECEPTOR,
  type CondicionIvaReceptorId,
  type DocumentoFiscalTipo,
  type FacturaElectronicaResumen,
  type FacturaFechaInput,
  type FacturaLinea,
  type FacturacionConfiguracionPublica,
  type FacturacionPreflight,
  type PerfilFiscalCliente,
} from "./types";
import type { TenantActor } from "./serverAuth";

type DbRecord = Record<string, unknown>;

type StoredConfig = {
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string;
  domicilio: string;
  ingresosBrutos: string | null;
  inicioActividades: string;
  puntoVenta: number;
  habilitada: boolean;
  certificatePath: string | null;
  privateKeyPath: string | null;
  certificateOriginalFilename: string | null;
  privateKeyOriginalFilename: string | null;
  fingerprintSha256: string | null;
  certificateExpiresAt: string | null;
  credentialsUpdatedAt: string | null;
};

type CanonicalArreglo = {
  id: string;
  estado: string;
  fecha: string | null;
  precioFinal: number;
  receptor: PerfilFiscalCliente;
  lineas: FacturaLinea[];
};

export type FacturaIssueInput = {
  idempotencyKey: string;
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

function record(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DbRecord) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableString(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function parseCondicion(value: unknown): CondicionIvaReceptorId | null {
  const parsed = number(value, 0) as CondicionIvaReceptorId;
  return CONDICIONES_IVA_RECEPTOR.some((condicion) => condicion.id === parsed) ? parsed : null;
}

function parseDocumento(value: unknown): DocumentoFiscalTipo | null {
  const parsed = number(value, 0) as DocumentoFiscalTipo;
  return parsed === 80 || parsed === 86 || parsed === 96 ? parsed : null;
}

function mapConfig(row: unknown): StoredConfig | null {
  if (!row) return null;
  const data = record(row);
  const cuit = text(data.cuit).replace(/\D/g, "");
  const certificatePath = asNullableString(data.cert_storage_path);
  const privateKeyPath = asNullableString(data.key_storage_path);
  const credentialsConfigured = Boolean(certificatePath && privateKeyPath);
  const config: StoredConfig = {
    razonSocial: text(data.razon_social),
    nombreFantasia: asNullableString(data.nombre_fantasia),
    cuit,
    domicilio: text(data.domicilio),
    ingresosBrutos: asNullableString(data.ingresos_brutos),
    inicioActividades: text(data.inicio_actividades),
    puntoVenta: number(data.punto_venta),
    habilitada: data.habilitada !== false && credentialsConfigured,
    certificatePath,
    privateKeyPath,
    certificateOriginalFilename: asNullableString(data.cert_original_filename),
    privateKeyOriginalFilename: asNullableString(data.key_original_filename),
    fingerprintSha256: asNullableString(data.cert_fingerprint_sha256),
    certificateExpiresAt: asNullableString(data.cert_expires_at),
    credentialsUpdatedAt: asNullableString(data.credenciales_updated_at),
  };
  return config;
}

function configToRow(config: FacturacionConfiguracionPublica) {
  return {
    razon_social: config.razonSocial.trim(),
    nombre_fantasia: config.nombreFantasia?.trim() || null,
    cuit: config.cuit.replace(/\D/g, ""),
    domicilio: config.domicilio.trim(),
    ingresos_brutos: config.ingresosBrutos?.trim() || null,
    inicio_actividades: config.inicioActividades,
    punto_venta: config.puntoVenta,
    habilitada: config.habilitada,
  };
}

function publicConfig(config: StoredConfig): FacturacionConfiguracionPublica {
  const configured = Boolean(config.certificatePath && config.privateKeyPath);
  return {
    razonSocial: config.razonSocial,
    nombreFantasia: config.nombreFantasia,
    cuit: config.cuit,
    domicilio: config.domicilio,
    ingresosBrutos: config.ingresosBrutos,
    inicioActividades: config.inicioActividades,
    puntoVenta: config.puntoVenta,
    habilitada: config.habilitada && configured,
    ambiente: "HOMOLOGACION",
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
  const data = record(value);
  const config: FacturacionConfiguracionPublica = {
    razonSocial: text(data.razonSocial),
    nombreFantasia: asNullableString(data.nombreFantasia),
    cuit: text(data.cuit).replace(/\D/g, ""),
    domicilio: text(data.domicilio),
    ingresosBrutos: asNullableString(data.ingresosBrutos),
    inicioActividades: text(data.inicioActividades),
    puntoVenta: number(data.puntoVenta),
    habilitada: data.habilitada !== false,
    ambiente: "HOMOLOGACION",
    credenciales: {
      configuradas: false,
      certificadoNombre: null,
      clavePrivadaNombre: null,
      fingerprintSha256: null,
      vencimiento: null,
      actualizadasAt: null,
    },
  };
  if (!config.razonSocial || !config.domicilio || config.cuit.length !== 11) {
    throw new FacturacionValidationError("Razón social, domicilio y CUIT de 11 dígitos son obligatorios");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.inicioActividades)) {
    throw new FacturacionValidationError("La fecha de inicio de actividades debe tener formato AAAA-MM-DD");
  }
  if (!Number.isInteger(config.puntoVenta) || config.puntoVenta <= 0) {
    throw new FacturacionValidationError("El punto de venta debe ser un entero positivo");
  }
  return config;
}

async function getStoredFacturacionConfig(tenantId: string): Promise<StoredConfig | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("facturacion_configuracion_tenant")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la configuración de facturación");
  return mapConfig(data);
}

export async function getFacturacionConfig(
  tenantId: string,
): Promise<FacturacionConfiguracionPublica | null> {
  const config = await getStoredFacturacionConfig(tenantId);
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
    throw new FacturacionValidationError(
      "Para reemplazar las credenciales debe seleccionar el certificado y la clave privada",
    );
  }
  const admin = createAdminClient();
  const previous = await getStoredFacturacionConfig(tenantId);
  const uploaded = certificate && privateKey
    ? await uploadCredentialPair(tenantId, certificate, privateKey)
    : null;
  const credentialsConfigured = Boolean(
    uploaded || (previous?.certificatePath && previous.privateKeyPath),
  );
  const { data, error } = await admin
    .from("facturacion_configuracion_tenant")
    .upsert({
      tenant_id: tenantId,
      ...configToRow({ ...config, habilitada: config.habilitada && credentialsConfigured }),
      ...(uploaded
        ? {
            cert_storage_path: uploaded.certificatePath,
            key_storage_path: uploaded.privateKeyPath,
            cert_original_filename: uploaded.certificateOriginalFilename,
            key_original_filename: uploaded.privateKeyOriginalFilename,
            cert_fingerprint_sha256: uploaded.fingerprintSha256,
            cert_expires_at: uploaded.expiresAt,
            credenciales_updated_at: new Date().toISOString(),
            credenciales_updated_by: userId,
          }
        : {}),
    }, { onConflict: "tenant_id" })
    .select("*")
    .single();
  if (error || !data) {
    if (uploaded) {
      await deleteCredentialPair(uploaded.certificatePath, uploaded.privateKeyPath).catch(() => undefined);
    }
    throw new Error("No se pudo guardar la configuración de facturación");
  }
  const stored = mapConfig(data);
  if (!stored) throw new Error("La configuración de facturación no se pudo leer luego de guardarla");
  if (uploaded && previous) {
    await deleteCredentialPair(previous.certificatePath, previous.privateKeyPath).catch(() => {
      console.error("No se pudieron limpiar las credenciales fiscales reemplazadas");
    });
  }
  return publicConfig(stored);
}

export async function testFacturacionConnection(tenantId: string) {
  const config = await getStoredFacturacionConfig(tenantId);
  if (!config) throw new FacturacionValidationError("La configuración fiscal está incompleta");
  const gateway = await createGatewayForConfig(config);
  const [status, lastVoucher] = await Promise.all([
    gateway.getServerStatus(),
    gateway.getLastVoucher(config.puntoVenta, 11),
  ]);
  return { status: sanitizeFiscalPayload(status), ultimoComprobante: lastVoucher };
}

async function createGatewayForConfig(config: StoredConfig) {
  if (!config.certificatePath || !config.privateKeyPath) {
    throw new FacturacionValidationError("Falta subir el certificado y la clave privada fiscal");
  }
  const credentials = await downloadCredentialPair(config.certificatePath, config.privateKeyPath);
  return createArcaGateway({ cuit: config.cuit, ...credentials });
}

async function getCanonicalArreglo(tenantId: string, arregloId: string): Promise<CanonicalArreglo> {
  const admin = createAdminClient();
  const { data: arregloData, error: arregloError } = await admin
    .from("arreglos")
    .select("id, tenant_id, vehiculo_id, estado, fecha, precio_final")
    .eq("id", arregloId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (arregloError || !arregloData) throw new FacturacionValidationError("Arreglo no encontrado");
  const arreglo = record(arregloData);
  const vehiculoId = text(arreglo.vehiculo_id);
  const { data: vehiculoData, error: vehiculoError } = await admin
    .from("vehiculos")
    .select("id, cliente_id")
    .eq("id", vehiculoId)
    .maybeSingle();
  if (vehiculoError || !vehiculoData || !text(record(vehiculoData).cliente_id)) {
    throw new FacturacionValidationError("El vehículo del arreglo no tiene un cliente asociado");
  }
  const clienteId = text(record(vehiculoData).cliente_id);
  const { data: clienteData, error: clienteError } = await admin
    .from("clientes")
    .select("id, tenant_id, tipo_cliente, tipo_documento_fiscal, numero_documento_fiscal, condicion_iva_receptor_id")
    .eq("id", clienteId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (clienteError || !clienteData) throw new FacturacionValidationError("Cliente del arreglo no encontrado");
  const cliente = record(clienteData);
  const tipoCliente = text(cliente.tipo_cliente);
  let nombre = "Cliente";
  let domicilio: string | null = null;
  if (tipoCliente === "empresa") {
    const { data } = await admin.from("empresas").select("nombre, direccion").eq("id", clienteId).maybeSingle();
    const empresa = record(data);
    nombre = text(empresa.nombre) || nombre;
    domicilio = asNullableString(empresa.direccion);
  } else {
    const { data } = await admin.from("particulares").select("nombre, apellido, direccion").eq("id", clienteId).maybeSingle();
    const particular = record(data);
    nombre = [text(particular.nombre), text(particular.apellido)].filter(Boolean).join(" ") || nombre;
    domicilio = asNullableString(particular.direccion);
  }
  const receptor: PerfilFiscalCliente = {
    clienteId,
    nombre,
    domicilio,
    tipoDocumento: parseDocumento(cliente.tipo_documento_fiscal),
    numeroDocumento: asNullableString(cliente.numero_documento_fiscal),
    condicionIvaReceptorId: parseCondicion(cliente.condicion_iva_receptor_id),
  };

  const lineas: FacturaLinea[] = [];
  const { data: detalles, error: detallesError } = await admin
    .from("detalle_arreglo")
    .select("id, descripcion, cantidad, valor")
    .eq("arreglo_id", arregloId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (detallesError) throw new Error("No se pudieron cargar los servicios del arreglo");
  for (const detalleValue of detalles ?? []) {
    const detalle = record(detalleValue);
    appendLine(lineas, {
      origen: "SERVICIO",
      sourceId: text(detalle.id),
      descripcion: text(detalle.descripcion),
      cantidad: number(detalle.cantidad),
      importeUnitario: number(detalle.valor),
      snapshot: detalle,
    });
  }

  const { data: forms, error: formsError } = await admin
    .from("detalle_form_custom")
    .select("id, costo, metadata, config_id, created_at")
    .eq("arreglo_id", arregloId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (formsError) throw new Error("No se pudo cargar el detalle de formulario del arreglo");
  const form = record((forms ?? [])[0]);
  if (Object.keys(form).length > 0 && number(form.costo) > 0) {
    appendLine(lineas, {
      origen: "FORMULARIO",
      sourceId: text(form.id),
      descripcion: "Cargo de formulario del arreglo",
      cantidad: 1,
      importeUnitario: number(form.costo),
      snapshot: form,
    });
  }

  const { data: asignaciones, error: asignacionesError } = await admin
    .from("operaciones_asignacion_arreglo")
    .select("operacion_id")
    .eq("arreglo_id", arregloId);
  if (asignacionesError) throw new Error("No se pudieron cargar las asignaciones de repuestos");
  const operationIds = (asignaciones ?? []).map((item) => text(record(item).operacion_id)).filter(Boolean);
  if (operationIds.length > 0) {
    const { data: operations, error: operationsError } = await admin
      .from("operaciones")
      .select("id")
      .in("id", operationIds)
      .eq("tenant_id", tenantId)
      .eq("tipo", "ASIGNACION_ARREGLO");
    if (operationsError) throw new Error("No se pudieron validar las asignaciones de repuestos");
    const validOperationIds = (operations ?? []).map((item) => text(record(item).id)).filter(Boolean);
    if (validOperationIds.length > 0) {
      const { data: repuestos, error: repuestosError } = await admin
        .from("operaciones_lineas")
        .select("id, stock_id, cantidad, monto_unitario, operacion_id")
        .in("operacion_id", validOperationIds)
        .order("created_at", { ascending: true });
      if (repuestosError) throw new Error("No se pudieron cargar las líneas de repuestos");
      const stockIds = (repuestos ?? []).map((item) => text(record(item).stock_id)).filter(Boolean);
      const stockById = new Map<string, DbRecord>();
      if (stockIds.length > 0) {
        const { data: stocks, error: stocksError } = await admin
          .from("stocks")
          .select("id, producto_id")
          .in("id", stockIds)
          .eq("tenant_id", tenantId);
        if (stocksError) throw new Error("No se pudo resolver el stock de los repuestos");
        for (const item of stocks ?? []) stockById.set(text(record(item).id), record(item));
      }
      const productIds = Array.from(stockById.values()).map((stock) => text(stock.producto_id)).filter(Boolean);
      const productById = new Map<string, DbRecord>();
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await admin
          .from("productos")
          .select("id, codigo, nombre")
          .in("id", productIds)
          .eq("tenant_id", tenantId);
        if (productsError) throw new Error("No se pudieron resolver los productos de los repuestos");
        for (const item of products ?? []) productById.set(text(record(item).id), record(item));
      }
      for (const repuestoValue of repuestos ?? []) {
        const repuesto = record(repuestoValue);
        const product = productById.get(text(stockById.get(text(repuesto.stock_id))?.producto_id)) ?? {};
        appendLine(lineas, {
          origen: "REPUESTO",
          sourceId: text(repuesto.id),
          descripcion: text(product.nombre) || "Repuesto",
          codigo: asNullableString(product.codigo),
          cantidad: number(repuesto.cantidad),
          importeUnitario: number(repuesto.monto_unitario),
          snapshot: { ...repuesto, producto: product },
        });
      }
    }
  }

  return {
    id: text(arreglo.id),
    estado: text(arreglo.estado),
    fecha: asNullableString(arreglo.fecha),
    precioFinal: number(arreglo.precio_final),
    receptor,
    lineas,
  };
}

function appendLine(
  lineas: FacturaLinea[],
  input: Omit<FacturaLinea, "ordinal" | "subtotal">,
) {
  const unitarioCentavos = amountToCents(input.importeUnitario);
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new FacturacionValidationError("La cantidad de una línea del arreglo no es válida");
  }
  const subtotalCentavos = Math.round(unitarioCentavos * input.cantidad);
  if (subtotalCentavos <= 0) return;
  lineas.push({
    ...input,
    ordinal: lineas.length + 1,
    importeUnitario: centsToAmount(unitarioCentavos),
    subtotal: centsToAmount(subtotalCentavos),
  });
}

function dateFromArreglo(value: string | null): string {
  if (!value) return toIsoDate(new Date());
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? toIsoDate(new Date()) : toIsoDate(parsed);
}

function defaultFechas(arregloDate: string | null, concepto: 1 | 2 | 3): FacturaFechaInput {
  const today = toIsoDate(new Date());
  if (concepto === 1) return { fechaComprobante: today };
  return {
    fechaComprobante: today,
    fechaServicioDesde: dateFromArreglo(arregloDate),
    fechaServicioHasta: today,
    fechaVencimientoPago: today,
  };
}

export async function getFacturaPreflight(actor: TenantActor, arregloId: string): Promise<{
  factura: FacturaElectronicaResumen | null;
  preflight: FacturacionPreflight;
}> {
  const [config, canonical] = await Promise.all([
    getStoredFacturacionConfig(actor.tenantId),
    getCanonicalArreglo(actor.tenantId, arregloId),
  ]);
  const admin = createAdminClient();
  const { data: invoiceData, error: invoiceError } = await admin
    .from("facturas_electronicas")
    .select("id, estado, numero_comprobante, cae, cae_vencimiento, total, concepto, created_at")
    .eq("tenant_id", actor.tenantId)
    .eq("arreglo_id", arregloId)
    .maybeSingle();
  if (invoiceError) throw new Error("No se pudo consultar la factura electrónica del arreglo");

  let concepto: 1 | 2 | 3 = 1;
  let diferenciasTotal = false;
  let mensaje: string | undefined;
  try {
    concepto = deriveFacturaConcepto(canonical.lineas);
    validateLineasYTotal(canonical.lineas, canonical.precioFinal);
  } catch (error) {
    diferenciasTotal = true;
    mensaje = error instanceof Error ? error.message : "No se pudo validar el detalle fiscal";
  }
  const factura = invoiceData ? mapInvoiceSummary(invoiceData) : null;
  const arregloTerminado = canonical.estado === "TERMINADO";
  if (!mensaje && !arregloTerminado) mensaje = "El arreglo debe estar terminado antes de facturarlo";
  if (!mensaje && (!config || !config.habilitada)) mensaje = "Falta completar o habilitar la configuración fiscal del tenant";
  if (!mensaje && factura?.estado === "AUTORIZADA") mensaje = "El arreglo ya tiene una factura electrónica autorizada";
  const puedeEmitir = actor.role === "admin"
    && arregloTerminado
    && Boolean(config?.habilitada)
    && !diferenciasTotal
    && (!factura || factura.estado === "RECHAZADA");
  return {
    factura,
    preflight: {
      puedeEmitir,
      configuracionCompleta: Boolean(config?.habilitada),
      arregloTerminado,
      diferenciasTotal,
      mensaje,
      emisor: config
        ? { razonSocial: config.razonSocial, cuit: config.cuit, puntoVenta: config.puntoVenta }
        : undefined,
      receptor: canonical.receptor,
      concepto,
      lineas: canonical.lineas,
      total: canonical.lineas.reduce((sum, linea) => sum + linea.subtotal, 0),
      precioFinal: canonical.precioFinal,
      fechasDefault: defaultFechas(canonical.fecha, concepto),
    },
  };
}

function mapInvoiceSummary(value: unknown): FacturaElectronicaResumen {
  const row = record(value);
  return {
    id: text(row.id),
    estado: text(row.estado) as FacturaElectronicaResumen["estado"],
    numeroComprobante: row.numero_comprobante == null ? null : number(row.numero_comprobante),
    cae: asNullableString(row.cae),
    caeVencimiento: asNullableString(row.cae_vencimiento),
    total: number(row.total),
    concepto: number(row.concepto) as 1 | 2 | 3,
    createdAt: asNullableString(row.created_at) ?? undefined,
  };
}

export function parseFacturaIssueInput(value: unknown): FacturaIssueInput {
  const data = record(value);
  const receptor = record(data.receptor);
  const fechas = record(data.fechas);
  const idempotencyKey = text(data.idempotencyKey);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new FacturacionValidationError("La clave de idempotencia debe ser un UUID válido");
  }
  return {
    idempotencyKey,
    receptor: {
      tipoDocumento: parseDocumento(receptor.tipoDocumento),
      numeroDocumento: asNullableString(receptor.numeroDocumento),
      condicionIvaReceptorId: parseCondicion(receptor.condicionIvaReceptorId),
    },
    fechas: {
      fechaComprobante: text(fechas.fechaComprobante),
      fechaServicioDesde: asNullableString(fechas.fechaServicioDesde),
      fechaServicioHasta: asNullableString(fechas.fechaServicioHasta),
      fechaVencimientoPago: asNullableString(fechas.fechaVencimientoPago),
    },
  };
}

function emitterSnapshot(config: StoredConfig) {
  return {
    razonSocial: config.razonSocial,
    nombreFantasia: config.nombreFantasia,
    cuit: config.cuit,
    domicilio: config.domicilio,
    ingresosBrutos: config.ingresosBrutos,
    inicioActividades: config.inicioActividades,
    condicionIva: "Monotributista",
  };
}

function receptorSnapshot(receptor: PerfilFiscalCliente) {
  const document = validateDocument(receptor.tipoDocumento, receptor.numeroDocumento);
  if (!receptor.condicionIvaReceptorId) {
    throw new FacturacionValidationError("La condición IVA del receptor es obligatoria");
  }
  return {
    clienteId: receptor.clienteId,
    nombre: receptor.nombre,
    domicilio: receptor.domicilio,
    tipoDocumento: document.tipoDocumento,
    numeroDocumento: document.numeroDocumento,
    condicionIvaReceptorId: receptor.condicionIvaReceptorId,
  };
}

async function saveFiscalProfile(tenantId: string, receptor: PerfilFiscalCliente) {
  const document = validateDocument(receptor.tipoDocumento, receptor.numeroDocumento);
  if (!receptor.condicionIvaReceptorId) throw new FacturacionValidationError("La condición IVA del receptor es obligatoria");
  const admin = createAdminClient();
  const { error } = await admin
    .from("clientes")
    .update({
      tipo_documento_fiscal: document.tipoDocumento,
      numero_documento_fiscal: document.numeroDocumento,
      condicion_iva_receptor_id: receptor.condicionIvaReceptorId,
    })
    .eq("id", receptor.clienteId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error("No se pudo guardar el perfil fiscal del cliente");
  if (document.tipoDocumento === 80) {
    const { error: empresaError } = await admin
      .from("empresas")
      .update({ cuit: document.numeroDocumento })
      .eq("id", receptor.clienteId);
    if (empresaError) throw new Error("No se pudo mantener sincronizado el CUIT de la empresa");
  }
}

function candidateMatches(candidate: Record<string, unknown>, info: Record<string, unknown>): boolean {
  return (
    number(info.ImpTotal, Number.NaN) === number(candidate.ImpTotal, Number.NaN)
    && number(info.DocTipo, Number.NaN) === number(candidate.DocTipo, Number.NaN)
    && number(info.DocNro, Number.NaN) === number(candidate.DocNro, Number.NaN)
    && text(info.CbteFch) === text(candidate.CbteFch)
  );
}

function arcaDateToIso(value: unknown): string | null {
  const compact = text(value).replace(/\D/g, "");
  return /^\d{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}` : null;
}

function errorDetails(error: unknown): { code: string | null; message: string; isLikelyRejection: boolean } {
  const row = record(error);
  const response = record(row.response);
  const code = asNullableString(row.code) ?? asNullableString(response.status);
  const message = error instanceof Error ? error.message : "Error desconocido al emitir el comprobante";
  return {
    code,
    message: message.slice(0, 1000),
    isLikelyRejection: Boolean(code) || Object.keys(response).length > 0,
  };
}

async function currentInvoice(tenantId: string, arregloId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("facturas_electronicas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("arreglo_id", arregloId)
    .maybeSingle();
  if (error) throw new Error("No se pudo consultar el estado fiscal del arreglo");
  return data;
}

async function acquireLease(config: StoredConfig, token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_facturacion_adquirir_lease", {
    p_emisor_cuit: config.cuit,
    p_punto_venta: config.puntoVenta,
    p_tipo_comprobante: 11,
    p_lease_token: token,
    p_segundos: 120,
  });
  if (error) throw new Error("No se pudo adquirir la exclusión de emisión fiscal");
  return data === true;
}

async function releaseLease(config: StoredConfig, token: string) {
  const admin = createAdminClient();
  await admin.rpc("rpc_facturacion_liberar_lease", {
    p_emisor_cuit: config.cuit,
    p_punto_venta: config.puntoVenta,
    p_tipo_comprobante: 11,
    p_lease_token: token,
  });
}

async function persistPendingInvoice(input: {
  existing: DbRecord | null;
  tenantId: string;
  actor: TenantActor;
  canonical: CanonicalArreglo;
  config: StoredConfig;
  idempotencyKey: string;
  concepto: 1 | 2 | 3;
  receptor: PerfilFiscalCliente;
  fechas: Required<FacturaFechaInput>;
  totalCentavos: number;
  candidateNumber: number;
}) {
  const admin = createAdminClient();
  const header = {
    tenant_id: input.tenantId,
    arreglo_id: input.canonical.id,
    idempotency_key: input.existing ? text(input.existing.idempotency_key) : input.idempotencyKey,
    estado: "PENDIENTE",
    ambiente: "HOMOLOGACION",
    emisor_snapshot: emitterSnapshot(input.config),
    receptor_snapshot: receptorSnapshot(input.receptor),
    concepto: input.concepto,
    fecha_comprobante: input.fechas.fechaComprobante,
    fecha_servicio_desde: input.concepto === 1 ? null : input.fechas.fechaServicioDesde,
    fecha_servicio_hasta: input.concepto === 1 ? null : input.fechas.fechaServicioHasta,
    fecha_vencimiento_pago: input.concepto === 1 ? null : input.fechas.fechaVencimientoPago,
    total: centsToAmount(input.totalCentavos),
    punto_venta: input.config.puntoVenta,
    tipo_comprobante: 11,
    numero_comprobante: input.candidateNumber,
    cae: null,
    cae_vencimiento: null,
    error_codigo: null,
    error_mensaje: null,
    created_by: input.actor.userId,
  };
  let invoice: unknown;
  if (input.existing) {
    const { data, error } = await admin
      .from("facturas_electronicas")
      .update(header)
      .eq("id", text(input.existing.id))
      .select("*")
      .single();
    if (error) throw new Error("No se pudo preparar el reintento de factura electrónica");
    invoice = data;
    const { error: deleteLinesError } = await admin
      .from("facturas_electronicas_lineas")
      .delete()
      .eq("factura_id", text(input.existing.id));
    if (deleteLinesError) throw new Error("No se pudieron renovar las líneas fiscales del reintento");
  } else {
    const { data, error } = await admin.from("facturas_electronicas").insert(header).select("*").single();
    if (error) throw new Error("No se pudo guardar la factura electrónica pendiente");
    invoice = data;
  }
  const invoiceId = text(record(invoice).id);
  const { error: linesError } = await admin.from("facturas_electronicas_lineas").insert(
    input.canonical.lineas.map((linea) => ({
      factura_id: invoiceId,
      ordinal: linea.ordinal,
      origen: linea.origen,
      source_id: linea.sourceId || null,
      descripcion: linea.descripcion,
      codigo: linea.codigo || null,
      cantidad: linea.cantidad,
      importe_unitario: linea.importeUnitario,
      subtotal: linea.subtotal,
      snapshot: linea.snapshot ?? {},
    })),
  );
  if (linesError) throw new Error("No se pudieron guardar las líneas fiscales de la factura");
  return record(invoice);
}

async function reconcileIncierta(config: StoredConfig, invoiceValue: unknown): Promise<FacturaElectronicaResumen | null> {
  const invoice = record(invoiceValue);
  const receiver = record(invoice.receptor_snapshot);
  const candidate = {
    ImpTotal: number(invoice.total),
    DocTipo: number(receiver.tipoDocumento),
    DocNro: number(receiver.numeroDocumento),
    CbteFch: text(invoice.fecha_comprobante).replaceAll("-", ""),
  };
  const voucherNumber = number(invoice.numero_comprobante);
  if (!voucherNumber) return null;
  const gateway = await createGatewayForConfig(config);
  const info = await gateway.getVoucherInfo(voucherNumber, config.puntoVenta, 11);
  if (!info || !candidateMatches(candidate, info)) return null;
  const admin = createAdminClient();
  const cae = asNullableString(info.CodAutorizacion) ?? asNullableString(info.CAE);
  const { data, error } = await admin
    .from("facturas_electronicas")
    .update({
      estado: "AUTORIZADA",
      cae,
      cae_vencimiento: arcaDateToIso(info.FchVto) ?? arcaDateToIso(info.CAEFchVto),
      error_codigo: null,
      error_mensaje: null,
    })
    .eq("id", invoice.id)
    .select("id, estado, numero_comprobante, cae, cae_vencimiento, total, concepto, created_at")
    .single();
  if (error || !data) throw new Error("ARCA confirmó la factura pero no se pudo reconciliar localmente");
  const { count } = await admin
    .from("facturacion_emision_intentos")
    .select("id", { count: "exact", head: true })
    .eq("factura_id", invoice.id);
  await admin.from("facturacion_emision_intentos").insert({
    factura_id: invoice.id,
    numero_intento: (count ?? 0) + 1,
    estado: "AUTORIZADO",
    candidato: { numero: voucherNumber, ...candidate, reconciliacion: true },
    response_sanitizada: sanitizeFiscalPayload(info),
    completed_at: new Date().toISOString(),
  });
  return mapInvoiceSummary(data);
}

export async function issueFacturaElectronica(
  actor: TenantActor,
  arregloId: string,
  input: FacturaIssueInput,
): Promise<FacturaIssueResult> {
  const config = await getStoredFacturacionConfig(actor.tenantId);
  if (!config?.habilitada) throw new FacturacionValidationError("La configuración fiscal está incompleta o deshabilitada");
  const canonical = await getCanonicalArreglo(actor.tenantId, arregloId);
  if (canonical.estado !== "TERMINADO") throw new FacturacionValidationError("Sólo se pueden facturar arreglos terminados");
  const receptor: PerfilFiscalCliente = {
    ...canonical.receptor,
    tipoDocumento: input.receptor.tipoDocumento,
    numeroDocumento: input.receptor.numeroDocumento,
    condicionIvaReceptorId: input.receptor.condicionIvaReceptorId,
  };
  const concepto = deriveFacturaConcepto(canonical.lineas);
  const totalCentavos = validateLineasYTotal(canonical.lineas, canonical.precioFinal);
  const fechas = validateFechas(concepto, input.fechas);
  const existingBeforeLease = await currentInvoice(actor.tenantId, arregloId);
  if (existingBeforeLease) {
    const existingSummary = mapInvoiceSummary(existingBeforeLease);
    if (existingSummary.estado === "AUTORIZADA") return { invoice: existingSummary, httpStatus: 200 };
    if (existingSummary.estado === "INCIERTA") {
      try {
        const reconciled = await reconcileIncierta(config, existingBeforeLease);
        if (reconciled) {
          return { invoice: reconciled, httpStatus: 200, message: "La factura se reconciliò consultando ARCA" };
        }
      } catch {
        // La consulta de reconciliación falló: se conserva el bloqueo sin asignar otro número.
      }
      return {
        invoice: existingSummary,
        httpStatus: 409,
        message: "La emisión anterior es incierta; ARCA no confirmó el comprobante candidato todavía",
      };
    }
    if (existingSummary.estado === "PENDIENTE") {
      return {
        invoice: existingSummary,
        httpStatus: 409,
        message: "La emisión anterior sigue pendiente o es incierta; debe reconciliarse antes de asignar otro número",
      };
    }
  }

  await saveFiscalProfile(actor.tenantId, receptor);
  const gateway = await createGatewayForConfig(config);
  const leaseToken = randomUUID();
  if (!(await acquireLease(config, leaseToken))) {
    throw new FacturacionValidationError("Hay otra emisión en curso para este punto de venta. Reintentá en unos segundos.");
  }
  try {
    const existing = await currentInvoice(actor.tenantId, arregloId);
    if (existing && text(record(existing).estado) !== "RECHAZADA") {
      const invoice = mapInvoiceSummary(existing);
      return {
        invoice,
        httpStatus: invoice.estado === "AUTORIZADA" ? 200 : 409,
        message: invoice.estado === "AUTORIZADA" ? undefined : "La factura ya está pendiente de reconciliación",
      };
    }
    const lastNumber = await gateway.getLastVoucher(config.puntoVenta, 11);
    const candidateNumber = lastNumber + 1;
    const payload = buildFacturaCPayload({
      voucherNumber: candidateNumber,
      puntoVenta: config.puntoVenta,
      concepto,
      receptor,
      fechas,
      totalCentavos,
    });
    const invoice = await persistPendingInvoice({
      existing: existing ? record(existing) : null,
      tenantId: actor.tenantId,
      actor,
      canonical,
      config,
      idempotencyKey: input.idempotencyKey,
      concepto,
      receptor,
      fechas,
      totalCentavos,
      candidateNumber,
    });
    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from("facturacion_emision_intentos")
      .select("id", { count: "exact", head: true })
      .eq("factura_id", text(invoice.id));
    if (countError) throw new Error("No se pudo enumerar los intentos de facturación");
    const attemptNumber = (count ?? 0) + 1;
    const { data: attempt, error: attemptError } = await admin
      .from("facturacion_emision_intentos")
      .insert({
        factura_id: invoice.id,
        numero_intento: attemptNumber,
        estado: "ENVIADO",
        candidato: { numero: candidateNumber, ...payload },
        request_sanitizado: sanitizeFiscalPayload(payload),
      })
      .select("id")
      .single();
    if (attemptError || !attempt) throw new Error("No se pudo registrar el intento fiscal");

    try {
      const response = await gateway.createVoucher(payload);
      const { data: updated, error: updateError } = await admin
        .from("facturas_electronicas")
        .update({
          estado: "AUTORIZADA",
          cae: response.CAE,
          cae_vencimiento: arcaDateToIso(response.CAEFchVto) ?? response.CAEFchVto,
          error_codigo: null,
          error_mensaje: null,
        })
        .eq("id", invoice.id)
        .select("id, estado, numero_comprobante, cae, cae_vencimiento, total, concepto, created_at")
        .single();
      if (updateError || !updated) throw new Error("ARCA autorizó el comprobante pero no se pudo persistir su CAE");
      await admin
        .from("facturacion_emision_intentos")
        .update({ estado: "AUTORIZADO", response_sanitizada: sanitizeFiscalPayload(response), completed_at: new Date().toISOString() })
        .eq("id", text(record(attempt).id));
      return { invoice: mapInvoiceSummary(updated), httpStatus: 201 };
    } catch (error) {
      let recovered: Record<string, unknown> | null = null;
      try {
        const info = await gateway.getVoucherInfo(candidateNumber, config.puntoVenta, 11);
        if (info && candidateMatches(payload, info)) recovered = info;
      } catch {
        // Si ni la consulta posterior responde, el estado se conserva incierto.
      }
      if (recovered) {
        const cae = asNullableString(recovered.CodAutorizacion) ?? asNullableString(recovered.CAE);
        const { data: updated, error: recoveredError } = await admin
          .from("facturas_electronicas")
          .update({
            estado: "AUTORIZADA",
            cae,
            cae_vencimiento: arcaDateToIso(recovered.FchVto) ?? arcaDateToIso(recovered.CAEFchVto),
            error_codigo: null,
            error_mensaje: null,
          })
          .eq("id", invoice.id)
          .select("id, estado, numero_comprobante, cae, cae_vencimiento, total, concepto, created_at")
          .single();
        if (recoveredError || !updated) throw new Error("Se encontró el comprobante en ARCA pero no se pudo reconciliar localmente");
        await admin
          .from("facturacion_emision_intentos")
          .update({ estado: "AUTORIZADO", response_sanitizada: sanitizeFiscalPayload(recovered), completed_at: new Date().toISOString() })
          .eq("id", text(record(attempt).id));
        return { invoice: mapInvoiceSummary(updated), httpStatus: 201, message: "La emisión se reconciliará a partir de la consulta a ARCA" };
      }
      const detail = errorDetails(error);
      const state = detail.isLikelyRejection ? "RECHAZADA" : "INCIERTA";
      const { data: updated, error: stateError } = await admin
        .from("facturas_electronicas")
        .update({ estado: state, error_codigo: detail.code, error_mensaje: detail.message })
        .eq("id", invoice.id)
        .select("id, estado, numero_comprobante, cae, cae_vencimiento, total, concepto, created_at")
        .single();
      if (stateError || !updated) throw new Error("No se pudo guardar el resultado de la emisión fiscal");
      await admin
        .from("facturacion_emision_intentos")
        .update({
          estado: state === "RECHAZADA" ? "RECHAZADO" : "INCIERTO",
          response_sanitizada: sanitizeFiscalPayload(record(error).response),
          error_codigo: detail.code,
          error_mensaje: detail.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", text(record(attempt).id));
      return { invoice: mapInvoiceSummary(updated), httpStatus: state === "RECHAZADA" ? 422 : 409, message: detail.message };
    }
  } finally {
    await releaseLease(config, leaseToken);
  }
}

export async function buildFacturaPdf(tenantId: string, facturaId: string): Promise<{
  bytes: Uint8Array;
  filename: string;
}> {
  const admin = createAdminClient();
  const { data: invoiceData, error: invoiceError } = await admin
    .from("facturas_electronicas")
    .select("*")
    .eq("id", facturaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (invoiceError || !invoiceData) throw new FacturacionValidationError("Factura electrónica no encontrada");
  const invoice = record(invoiceData);
  if (text(invoice.estado) !== "AUTORIZADA") throw new FacturacionValidationError("El PDF sólo está disponible para facturas autorizadas");
  const { data: lines, error: linesError } = await admin
    .from("facturas_electronicas_lineas")
    .select("codigo, descripcion, cantidad, importe_unitario, subtotal")
    .eq("factura_id", facturaId)
    .order("ordinal", { ascending: true });
  if (linesError) throw new Error("No se pudieron cargar las líneas fiscales para el PDF");
  const voucherNumber = number(invoice.numero_comprobante);
  const fiscalInvoice: FiscalPdfInvoice = {
    id: text(invoice.id),
    emisorSnapshot: record(invoice.emisor_snapshot),
    receptorSnapshot: record(invoice.receptor_snapshot),
    concepto: number(invoice.concepto),
    fechaComprobante: text(invoice.fecha_comprobante),
    fechaServicioDesde: asNullableString(invoice.fecha_servicio_desde),
    fechaServicioHasta: asNullableString(invoice.fecha_servicio_hasta),
    fechaVencimientoPago: asNullableString(invoice.fecha_vencimiento_pago),
    total: number(invoice.total),
    puntoVenta: number(invoice.punto_venta),
    tipoComprobante: number(invoice.tipo_comprobante),
    numeroComprobante: voucherNumber,
    cae: text(invoice.cae),
    caeVencimiento: text(invoice.cae_vencimiento),
    lineas: (lines ?? []).map((lineValue) => {
      const line = record(lineValue);
      return {
        codigo: asNullableString(line.codigo),
        descripcion: text(line.descripcion),
        cantidad: number(line.cantidad),
        importeUnitario: number(line.importe_unitario),
        subtotal: number(line.subtotal),
      };
    }),
  };
  const bytes = await generateFiscalInvoicePdf(fiscalInvoice);
  return {
    bytes,
    filename: `factura-c-${String(fiscalInvoice.puntoVenta).padStart(5, "0")}-${String(voucherNumber).padStart(8, "0")}.pdf`,
  };
}

export { FacturacionValidationError, normalizeDocumentNumber };
