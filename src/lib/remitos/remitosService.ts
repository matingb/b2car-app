import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/app/api/apiError";
import {
  CONDICIONES_IVA_RECEPTOR,
  comprobanteLabel,
  type CondicionIvaEmisor,
  type CondicionIvaReceptorId,
  type DocumentoFiscalClase,
  type FacturaClase,
  type FacturaLineaOrigen,
  type FacturacionAmbiente,
} from "@/lib/facturacion/types";
import { parseCalendarDate } from "@/lib/fechas";
import { isValidUuid } from "@/lib/uuid";
import { calcularDisponibles, evaluarEmisor, evaluarRemitoR, hoyArgentinaISO } from "./remitoValidation";
import { generateRemitoPdf, remitoPdfFilename } from "./remitoPdf";
import {
  formatRemitoDocumento,
  formatRemitoNumero,
  type AsociarFacturaInput,
  type EmitirRemitoInput,
  type FacturaRemitos,
  type RemitoClase,
  type RemitoArregloOrigen,
  type RemitoDestinatario,
  type RemitoDetalle,
  type RemitoFacturaLineaDisponible,
  type RemitoFacturaRef,
  type RemitoImpresion,
  type RemitoPreflight,
  type RemitoResumen,
  type RemitosConfiguracion,
  type RemitosConfiguracionInput,
  type RemitosFiltros,
  type RemitosPaginados,
} from "./types";

/*
 * Servicio de remitos. No importa gateways de ARCA ni escribe en tablas fiscales:
 * emitir o imprimir un remito nunca genera ni modifica comprobantes.
 * Todas las consultas a facturas y sus líneas usan columnas explícitas sin importes.
 */

type DbRecord = Record<string, unknown>;

const FACTURA_REF_COLUMNS = "id, documento_tipo, clase_comprobante, punto_venta, numero_comprobante";
export const REMITO_RESUMEN_COLUMNS = "id, clase, punto_emision, numero, fecha_emision, ambiente, destinatario_snapshot, arreglo_id, factura_id, created_at, "
  + `factura:facturas_electronicas(${FACTURA_REF_COLUMNS})`;
const DETALLE_COLUMNS = "id, clase, tipo_comprobante, punto_emision, numero, fecha_emision, ambiente, emisor_snapshot, "
  + "destinatario_snapshot, transportista_snapshot, cai, cai_vencimiento, impresion_snapshot, observaciones, arreglo_id, factura_id, "
  + `factura_asociada_at, created_at, factura:facturas_electronicas(${FACTURA_REF_COLUMNS}, fecha_comprobante, receptor_snapshot)`;
const REMITO_LINEA_COLUMNS = "id, ordinal, codigo, descripcion, observaciones, cantidad, factura_linea_id";
const FACTURA_LINEA_COLUMNS = "id, ordinal, origen, codigo, descripcion, cantidad";
const CONFIG_COLUMNS = "r_cai, r_cai_vencimiento, r_punto_emision, r_numero_desde, r_numero_hasta, r_proximo_numero, "
  + "r_inicio_actividades, x_punto_emision, x_proximo_numero, updated_at";

function record(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DbRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function nullable(value: unknown): string | null {
  return text(value) || null;
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  return value == null || value === "" ? null : number(value);
}

function parseAmbiente(value: unknown): FacturacionAmbiente {
  return value === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION";
}

function parseClase(value: unknown): RemitoClase {
  return value === "R" ? "R" : "X";
}

function parseCondicionIva(value: unknown): CondicionIvaReceptorId | null {
  const parsed = number(value, NaN);
  return CONDICIONES_IVA_RECEPTOR.find((item) => item.id === parsed)?.id ?? null;
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

function facturaLabel(value: unknown): string {
  const factura = record(value);
  const documento = (text(factura.documento_tipo) || "FACTURA") as DocumentoFiscalClase;
  const clase = (text(factura.clase_comprobante) || "C") as FacturaClase;
  const numero = factura.numero_comprobante == null
    ? "Sin número"
    : `${pad(number(factura.punto_venta), 5)}-${pad(number(factura.numero_comprobante), 8)}`;
  return `${comprobanteLabel(documento, clase)} ${numero}`;
}

function mapDestinatario(value: unknown): RemitoDestinatario {
  const raw = record(value);
  const tipo = number(raw.tipoDocumento, NaN);
  const tipoDocumento = tipo === 80 || tipo === 86 || tipo === 96 ? tipo : null;
  const numeroDocumento = tipoDocumento ? text(raw.numeroDocumento).replace(/\D/g, "") || null : null;
  return {
    clienteId: isValidUuid(raw.clienteId) ? raw.clienteId : null,
    nombre: text(raw.nombre),
    domicilio: nullable(raw.domicilio),
    tipoDocumento: numeroDocumento ? tipoDocumento : null,
    numeroDocumento,
    condicionIvaReceptorId: parseCondicionIva(raw.condicionIvaReceptorId),
    condicionIva: nullable(raw.condicionIva),
  };
}

export function mapResumen(value: unknown): RemitoResumen {
  const row = record(value);
  const clase = parseClase(row.clase);
  const puntoEmision = number(row.punto_emision);
  const numero = number(row.numero);
  const destinatario = mapDestinatario(row.destinatario_snapshot);
  return {
    id: text(row.id),
    clase,
    puntoEmision,
    numero,
    numeroVisible: formatRemitoNumero(clase, puntoEmision, numero),
    fechaEmision: text(row.fecha_emision),
    ambiente: parseAmbiente(row.ambiente),
    destinatarioNombre: destinatario.nombre,
    destinatarioDocumento: formatRemitoDocumento(destinatario),
    arregloId: nullable(row.arreglo_id),
    factura: row.factura_id ? { id: text(row.factura_id), label: facturaLabel(row.factura) } : null,
  };
}

function mapFacturaRef(id: unknown, value: unknown): RemitoFacturaRef {
  const factura = record(value);
  const receptor = mapDestinatario(factura.receptor_snapshot);
  return {
    id: text(id),
    label: facturaLabel(factura),
    fechaComprobante: nullable(factura.fecha_comprobante),
    receptorNombre: receptor.nombre || null,
    receptorDocumento: formatRemitoDocumento(receptor),
  };
}

function mapImpresion(value: unknown): RemitoImpresion | null {
  if (!value) return null;
  const raw = record(value);
  const imprenta = raw.imprenta ? record(raw.imprenta) : null;
  return {
    autoimpresor: raw.autoimpresor === true,
    numeroDesde: nullableNumber(raw.numeroDesde),
    numeroHasta: nullableNumber(raw.numeroHasta),
    inicioActividades: nullable(raw.inicioActividades),
    imprenta: imprenta ? {
      razonSocial: text(imprenta.razonSocial),
      cuit: text(imprenta.cuit),
      fechaImpresion: nullable(imprenta.fechaImpresion),
      habilitacion: text(imprenta.habilitacion),
    } : null,
  };
}

function mapDetalle(value: unknown, lineas: unknown[]): RemitoDetalle {
  const row = record(value);
  const resumen = mapResumen(row);
  const emisor = record(row.emisor_snapshot);
  const transportista = row.transportista_snapshot ? record(row.transportista_snapshot) : null;
  return {
    ...resumen,
    tipoComprobante: row.tipo_comprobante == null ? null : number(row.tipo_comprobante),
    emisor: {
      razonSocial: text(emisor.razonSocial),
      nombreFantasia: nullable(emisor.nombreFantasia),
      cuit: text(emisor.cuit),
      domicilio: text(emisor.domicilio),
      ingresosBrutos: nullable(emisor.ingresosBrutos),
      inicioActividades: nullable(emisor.inicioActividades),
      condicionIvaEmisor: (text(emisor.condicionIvaEmisor) || "MONOTRIBUTISTA") as CondicionIvaEmisor,
      condicionIva: text(emisor.condicionIva),
    },
    destinatario: mapDestinatario(row.destinatario_snapshot),
    transportista: transportista ? {
      nombre: text(transportista.nombre),
      domicilio: nullable(transportista.domicilio),
      cuit: nullable(transportista.cuit),
    } : null,
    cai: nullable(row.cai),
    caiVencimiento: nullable(row.cai_vencimiento),
    impresion: mapImpresion(row.impresion_snapshot),
    observaciones: nullable(row.observaciones),
    arregloId: nullable(row.arreglo_id),
    lineas: lineas.map((item) => {
      const linea = record(item);
      return {
        id: text(linea.id),
        ordinal: number(linea.ordinal),
        codigo: nullable(linea.codigo),
        descripcion: text(linea.descripcion),
        observaciones: nullable(linea.observaciones),
        cantidad: number(linea.cantidad),
        facturaLineaId: nullable(linea.factura_linea_id),
      };
    }),
    factura: row.factura_id ? mapFacturaRef(row.factura_id, row.factura) : null,
    facturaAsociadaAt: nullable(row.factura_asociada_at),
    createdAt: text(row.created_at),
  };
}

function mapFacturaLinea(value: unknown) {
  const row = record(value);
  return {
    id: text(row.id),
    ordinal: number(row.ordinal),
    origen: text(row.origen) as FacturaLineaOrigen,
    codigo: nullable(row.codigo),
    descripcion: text(row.descripcion),
    cantidad: number(row.cantidad),
  };
}

async function lineasDisponibles(supabase: SupabaseClient, facturaId: string): Promise<RemitoFacturaLineaDisponible[]> {
  const { data: lineas, error } = await supabase
    .from("facturas_electronicas_lineas")
    .select(FACTURA_LINEA_COLUMNS)
    .eq("factura_id", facturaId)
    .order("ordinal");
  if (error) throw error;
  const facturaLineas = (lineas ?? []).map(mapFacturaLinea);
  if (facturaLineas.length === 0) return [];

  const { data: remitidas, error: remitidasError } = await supabase
    .from("remitos_lineas")
    .select("factura_linea_id, cantidad")
    .in("factura_linea_id", facturaLineas.map((linea) => linea.id));
  if (remitidasError) throw remitidasError;

  return calcularDisponibles(facturaLineas, (remitidas ?? []).map((item) => {
    const row = record(item);
    return { facturaLineaId: nullable(row.factura_linea_id), cantidad: number(row.cantidad) };
  }));
}

async function ultimoNumero(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
  clase: RemitoClase,
  puntoEmision: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("remitos")
    .select("numero")
    .eq("tenant_id", tenantId)
    .eq("ambiente", ambiente)
    .eq("clase", clase)
    .eq("punto_emision", puntoEmision)
    .order("numero", { ascending: false })
    .limit(1);
  if (error) throw error;
  const numero = data?.[0] ? number(record(data[0]).numero) : null;
  return numero ? formatRemitoNumero(clase, puntoEmision, numero) : null;
}

export async function getRemitosConfiguracion(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
): Promise<RemitosConfiguracion> {
  const { data, error } = await supabase
    .from("remitos_configuracion")
    .select(CONFIG_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("ambiente", ambiente)
    .maybeSingle();
  if (error) throw error;
  const row = record(data);
  const puntoR = nullableNumber(row.r_punto_emision);
  const puntoX = nullableNumber(row.x_punto_emision) ?? 1;
  const [ultimoR, ultimoX] = await Promise.all([
    puntoR ? ultimoNumero(supabase, tenantId, ambiente, "R", puntoR) : Promise.resolve(null),
    ultimoNumero(supabase, tenantId, ambiente, "X", puntoX),
  ]);
  return {
    ambiente,
    remitoR: {
      cai: nullable(row.r_cai),
      caiVencimiento: nullable(row.r_cai_vencimiento),
      puntoEmision: puntoR,
      numeroDesde: nullableNumber(row.r_numero_desde),
      numeroHasta: nullableNumber(row.r_numero_hasta),
      proximoNumero: nullableNumber(row.r_proximo_numero) ?? 1,
      inicioActividades: nullable(row.r_inicio_actividades),
      autoimpresor: true,
      imprenta: {
        razonSocial: null,
        cuit: null,
        fechaImpresion: null,
        habilitacion: null,
      },
    },
    remitoX: {
      puntoEmision: puntoX,
      proximoNumero: nullableNumber(row.x_proximo_numero) ?? 1,
    },
    ultimoEmitido: { R: ultimoR, X: ultimoX },
    updatedAt: nullable(row.updated_at),
  };
}

export async function saveRemitosConfiguracion(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  ambiente: FacturacionAmbiente,
  input: RemitosConfiguracionInput,
): Promise<RemitosConfiguracion> {
  const { remitoR, remitoX } = input;
  const { error } = await supabase.from("remitos_configuracion").upsert({
    tenant_id: tenantId,
    ambiente,
    r_cai: remitoR.cai,
    r_cai_vencimiento: remitoR.caiVencimiento,
    r_punto_emision: remitoR.puntoEmision,
    r_numero_desde: remitoR.numeroDesde,
    r_numero_hasta: remitoR.numeroHasta,
    r_proximo_numero: remitoR.proximoNumero,
    r_inicio_actividades: remitoR.inicioActividades,
    r_autoimpresor: true,
    r_imprenta_razon_social: null,
    r_imprenta_cuit: null,
    r_imprenta_fecha_impresion: null,
    r_imprenta_habilitacion: null,
    x_punto_emision: remitoX.puntoEmision,
    x_proximo_numero: remitoX.proximoNumero,
    updated_by: userId,
  }, { onConflict: "tenant_id,ambiente" });
  if (error) throw error;
  return getRemitosConfiguracion(supabase, tenantId, ambiente);
}

function destinatarioDesdeFactura(snapshot: unknown): RemitoDestinatario {
  const destinatario = mapDestinatario(snapshot);
  return { ...destinatario, nombre: destinatario.nombre || "Consumidor final" };
}

async function facturaRemitible(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
  facturaId: string,
): Promise<NonNullable<RemitoPreflight["factura"]>> {
  const { data, error } = await supabase
    .from("facturas_electronicas")
    .select(`${FACTURA_REF_COLUMNS}, estado, ambiente, fecha_comprobante, receptor_snapshot`)
    .eq("id", facturaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Factura no encontrada", "NOT_FOUND");
  const factura = record(data);
  if (factura.documento_tipo !== "FACTURA" || factura.estado !== "AUTORIZADA") {
    throw new ApiError(400, "Solo se pueden generar remitos desde facturas autorizadas", "VALIDATION");
  }
  if (factura.ambiente !== ambiente) {
    throw new ApiError(400, "La factura pertenece a otro ambiente fiscal", "VALIDATION");
  }
  return {
    id: text(factura.id),
    label: facturaLabel(factura),
    fechaComprobante: nullable(factura.fecha_comprobante),
    destinatario: destinatarioDesdeFactura(factura.receptor_snapshot),
    lineas: await lineasDisponibles(supabase, facturaId),
  };
}

async function getArregloRemitible(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
  arregloId: string,
): Promise<RemitoArregloOrigen> {
  const [sourceResult, detalleResult] = await Promise.all([
    supabase
      .from("arreglos")
      .select("id, numero_orden, cliente_id")
      .eq("id", arregloId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.rpc("rpc_get_arreglo_detalle", { p_arreglo_id: arregloId }),
  ]);
  if (sourceResult.error) throw sourceResult.error;
  if (detalleResult.error) throw detalleResult.error;
  if (!sourceResult.data || !detalleResult.data) throw new ApiError(404, "Arreglo no encontrado", "NOT_FOUND");

  // Evita precargar números de otro ambiente o de una factura aún no autorizada.
  const facturaResult = await supabase
    .from("facturas_electronicas")
    .select("id, punto_venta, numero_comprobante")
    .eq("tenant_id", tenantId)
    .eq("ambiente", ambiente)
    .eq("arreglo_id", arregloId)
    .eq("documento_tipo", "FACTURA")
    .eq("estado", "AUTORIZADA")
    .maybeSingle();
  if (facturaResult.error) throw facturaResult.error;

  const source = record(sourceResult.data);
  const detalle = record(detalleResult.data);
  const arreglo = record(detalle.arreglo);
  const vehiculo = record(arreglo.vehiculo);
  const facturaAsociada = record(facturaResult.data);
  const facturaNumero = facturaResult.data && facturaAsociada.numero_comprobante != null
    ? `${pad(number(facturaAsociada.punto_venta), 5)}-${pad(number(facturaAsociada.numero_comprobante), 8)}`
    : null;
  const clienteId = isValidUuid(source.cliente_id) ? source.cliente_id : null;
  let nombre = text(vehiculo.nombre_cliente);
  let domicilio: string | null = null;
  let tipoDocumento: RemitoDestinatario["tipoDocumento"] = null;
  let numeroDocumento: string | null = null;

  if (clienteId) {
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, tipo_cliente")
      .eq("id", clienteId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (clienteError) throw clienteError;

    if (cliente?.tipo_cliente === "empresa") {
      const { data: empresa, error: empresaError } = await supabase
        .from("empresas")
        .select("nombre, direccion, cuit")
        .eq("id", clienteId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (empresaError) throw empresaError;
      if (empresa) {
        nombre = text(empresa.nombre) || nombre;
        domicilio = nullable(empresa.direccion);
        const cuit = text(empresa.cuit).replace(/\D/g, "");
        if (cuit) {
          tipoDocumento = 80;
          numeroDocumento = cuit;
        }
      }
    } else if (cliente?.tipo_cliente === "particular") {
      const { data: particular, error: particularError } = await supabase
        .from("particulares")
        .select("nombre, apellido, direccion, dni_cuil")
        .eq("id", clienteId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (particularError) throw particularError;
      if (particular) {
        nombre = [text(particular.nombre), text(particular.apellido)].filter(Boolean).join(" ") || nombre;
        domicilio = nullable(particular.direccion);
        const documento = text(particular.dni_cuil).replace(/\D/g, "");
        if (documento) {
          tipoDocumento = documento.length === 11 ? 86 : 96;
          numeroDocumento = documento;
        }
      }
    }
  }

  const repuestosPendientes = Array.isArray(arreglo.repuestos_pendientes)
    ? arreglo.repuestos_pendientes.map((value) => {
        const linea = record(value);
        return {
          codigo: nullable(linea.codigo),
          descripcion: text(linea.nombre) || text(linea.descripcion) || "Repuesto",
          cantidad: number(linea.cantidad),
        };
      })
    : [];
  const lineasAsignadas = (Array.isArray(detalle.asignaciones) ? detalle.asignaciones : []).flatMap((value) => {
    const operacion = record(value);
    return (Array.isArray(operacion.lineas) ? operacion.lineas : []).map((lineValue) => {
      const linea = record(lineValue);
      const producto = record(linea.producto);
      return {
        codigo: nullable(producto.codigo),
        descripcion: text(producto.nombre) || "Repuesto",
        cantidad: number(linea.cantidad),
      };
    });
  });
  const lineas = [...repuestosPendientes, ...lineasAsignadas]
    .filter((linea) => linea.cantidad > 0 && linea.descripcion.trim());

  return {
    id: arregloId,
    label: source.numero_orden == null ? "Arreglo" : `Arreglo N° ${number(source.numero_orden)}`,
    facturaId: nullable(facturaAsociada.id),
    facturaNumero,
    destinatario: {
      clienteId,
      nombre: nombre || "Cliente",
      domicilio,
      tipoDocumento,
      numeroDocumento,
      condicionIvaReceptorId: null,
    },
    lineas: lineas.slice(0, 200),
  };
}

/** Estado previo a emitir: emisor, emitibilidad de R/X y, si corresponde, la factura de origen. No consulta ARCA. */
export async function getRemitoPreflight(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
  facturaId: string | null,
  arregloId: string | null = null,
): Promise<RemitoPreflight> {
  if (facturaId && arregloId) {
    throw new ApiError(400, "Iniciá el remito desde un arreglo o desde una factura, no desde ambos", "VALIDATION");
  }
  const [fiscal, config, facturaOrigen, arreglo] = await Promise.all([
    supabase
      .from("facturacion_configuracion_ambiente")
      .select("razon_social, cuit, domicilio, inicio_actividades")
      .eq("tenant_id", tenantId)
      .eq("ambiente", ambiente)
      .maybeSingle(),
    getRemitosConfiguracion(supabase, tenantId, ambiente),
    facturaId ? facturaRemitible(supabase, tenantId, ambiente, facturaId) : Promise.resolve(null),
    arregloId ? getArregloRemitible(supabase, tenantId, ambiente, arregloId) : Promise.resolve(null),
  ]);
  if (fiscal.error) throw fiscal.error;
  const factura = arreglo?.facturaId
    ? await facturaRemitible(supabase, tenantId, ambiente, arreglo.facturaId)
    : facturaOrigen;
  const emisor = fiscal.data ? record(fiscal.data) : null;
  const evaluacionR = evaluarRemitoR(config.remitoR, hoyArgentinaISO());
  return {
    ambiente,
    emisor: evaluarEmisor(emisor ? {
      razonSocial: text(emisor.razon_social),
      cuit: text(emisor.cuit),
      domicilio: text(emisor.domicilio),
      inicioActividades: nullable(emisor.inicio_actividades),
    } : null),
    tipos: {
      R: {
        ...evaluacionR,
        proximoNumeroVisible: config.remitoR.puntoEmision
          ? formatRemitoNumero("R", config.remitoR.puntoEmision, config.remitoR.proximoNumero)
          : null,
      },
      X: {
        emitible: true,
        motivos: [],
        proximoNumeroVisible: formatRemitoNumero("X", config.remitoX.puntoEmision, config.remitoX.proximoNumero),
      },
    },
    factura,
    arreglo,
  };
}

export async function emitirRemito(
  supabase: SupabaseClient,
  ambiente: FacturacionAmbiente,
  input: EmitirRemitoInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("rpc_remitos_emitir", {
    p_idempotency_key: input.idempotencyKey,
    p_ambiente: ambiente,
    p_clase: input.clase,
    p_arreglo_id: input.arregloId,
    p_factura_id: input.facturaId,
    p_destinatario: input.destinatario,
    p_transportista: input.transportista,
    p_observaciones: input.observaciones,
    p_lineas: input.lineas.map((linea) => ({
      factura_linea_id: linea.facturaLineaId,
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      observaciones: linea.observaciones,
      cantidad: linea.cantidad,
    })),
  });
  if (error) throw error;
  if (!isValidUuid(data)) throw new Error("Respuesta inválida al emitir el remito");
  return data;
}

export async function asociarFactura(
  supabase: SupabaseClient,
  remitoId: string,
  input: AsociarFacturaInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("rpc_remitos_asociar_factura", {
    p_remito_id: remitoId,
    p_factura_id: input.facturaId,
    p_lineas: input.lineas.map((linea) => ({
      remito_linea_id: linea.remitoLineaId,
      factura_linea_id: linea.facturaLineaId,
    })),
  });
  if (error) throw error;
  if (!isValidUuid(data)) throw new Error("Respuesta inválida al asociar el remito");
  return data;
}

type RemitoNumeroSearch = { clase?: RemitoClase; puntoEmision?: number; numero: number };

/** Acepta `8`, `00001-00000008` o `R 00001-00000008`. */
export function parseRemitoNumeroSearch(value: string): RemitoNumeroSearch | null {
  const match = /^(?:([RXrx])\s*)?(\d{1,8})(?:\s*-\s*(\d{1,8}))?$/.exec(value.trim());
  if (!match) return null;
  const clase = match[1] ? match[1].toUpperCase() as RemitoClase : undefined;
  const first = Number(match[2]);
  const second = match[3] ? Number(match[3]) : null;
  if (second !== null) return first > 0 && second > 0 ? { clase, puntoEmision: first, numero: second } : null;
  return first > 0 ? { clase, numero: first } : null;
}

/** Condiciones PostgREST `or` de la búsqueda libre de remitos (texto ya saneado). */
export function remitoSearchConditions(search: string): string[] {
  const conditions = [
    `destinatario_snapshot->>nombre.ilike.%${search}%`,
    `destinatario_snapshot->>numeroDocumento.ilike.%${search}%`,
  ];
  const numero = parseRemitoNumeroSearch(search);
  if (numero) {
    const parts = [`numero.eq.${numero.numero}`];
    if (numero.puntoEmision) parts.push(`punto_emision.eq.${numero.puntoEmision}`);
    if (numero.clase) parts.push(`clase.eq.${numero.clase}`);
    conditions.push(parts.length > 1 ? `and(${parts.join(",")})` : parts[0]);
  }
  return conditions;
}

export async function listRemitos(
  supabase: SupabaseClient,
  tenantId: string,
  ambiente: FacturacionAmbiente,
  filtros: RemitosFiltros = {},
): Promise<RemitosPaginados> {
  const page = Math.max(1, Math.trunc(number(filtros.page, 1)));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(number(filtros.pageSize, 25))));
  if (filtros.clase && filtros.clase !== "R" && filtros.clase !== "X") {
    throw new ApiError(400, "El tipo de remito del filtro no es válido", "VALIDATION");
  }
  if (filtros.factura && filtros.factura !== "con" && filtros.factura !== "sin") {
    throw new ApiError(400, "El filtro de factura no es válido", "VALIDATION");
  }
  if ((filtros.desde && !parseCalendarDate(filtros.desde)) || (filtros.hasta && !parseCalendarDate(filtros.hasta))) {
    throw new ApiError(400, "Las fechas del filtro deben tener formato AAAA-MM-DD", "VALIDATION");
  }
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new ApiError(400, "La fecha desde no puede ser posterior a la fecha hasta", "VALIDATION");
  }

  const from = (page - 1) * pageSize;
  let query = supabase
    .from("remitos")
    .select(REMITO_RESUMEN_COLUMNS, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("ambiente", ambiente)
    .order("fecha_emision", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (filtros.clase) query = query.eq("clase", filtros.clase);
  if (filtros.factura === "con") query = query.not("factura_id", "is", null);
  if (filtros.factura === "sin") query = query.is("factura_id", null);
  if (filtros.desde) query = query.gte("fecha_emision", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha_emision", filtros.hasta);
  if (filtros.search) {
    const search = filtros.search.replace(/[%_,()]/g, "").trim();
    if (search.length > 100) throw new ApiError(400, "La búsqueda no puede superar los 100 caracteres", "VALIDATION");
    if (search) query = query.or(remitoSearchConditions(search).join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []).map(mapResumen), page, pageSize, total: count ?? 0 };
}

export async function getRemitoDetalle(supabase: SupabaseClient, tenantId: string, remitoId: string): Promise<RemitoDetalle> {
  const { data, error } = await supabase
    .from("remitos")
    .select(DETALLE_COLUMNS)
    .eq("id", remitoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Remito no encontrado", "NOT_FOUND");

  const { data: lineas, error: lineasError } = await supabase
    .from("remitos_lineas")
    .select(REMITO_LINEA_COLUMNS)
    .eq("remito_id", remitoId)
    .order("ordinal");
  if (lineasError) throw lineasError;
  return mapDetalle(data, lineas ?? []);
}

export async function getFacturaRemitos(supabase: SupabaseClient, tenantId: string, facturaId: string): Promise<FacturaRemitos> {
  const { data: factura, error } = await supabase
    .from("facturas_electronicas")
    .select("id")
    .eq("id", facturaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!factura) throw new ApiError(404, "Factura no encontrada", "NOT_FOUND");

  const [remitos, lineas] = await Promise.all([
    supabase
      .from("remitos")
      .select(REMITO_RESUMEN_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("factura_id", facturaId)
      .order("fecha_emision", { ascending: false })
      .order("created_at", { ascending: false }),
    lineasDisponibles(supabase, facturaId),
  ]);
  if (remitos.error) throw remitos.error;
  return { remitos: (remitos.data ?? []).map(mapResumen), lineas };
}

export async function buildRemitoPdf(
  supabase: SupabaseClient,
  tenantId: string,
  remitoId: string,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const detalle = await getRemitoDetalle(supabase, tenantId, remitoId);
  return { bytes: await generateRemitoPdf(detalle), filename: remitoPdfFilename(detalle) };
}
