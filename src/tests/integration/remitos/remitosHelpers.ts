import { randomUUID } from "crypto";
import { expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminTestClient, testClient, SEED } from "@/tests/integration";
import { dadoUnArreglo } from "../helpers/integrationFixtures";
import { APP_TIME_ZONE } from "@/lib/fechas";

const adminClient = createAdminTestClient();

export const AMBIENTE = "HOMOLOGACION";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LineaRemitoInput {
  codigo?: string | null;
  descripcion?: string;
  observaciones?: string | null;
  cantidad: number | string;
  factura_linea_id?: string;
}

export interface EmitirRemitoArgs {
  clase: "R" | "X";
  lineas?: LineaRemitoInput[];
  arregloId?: string | null;
  facturaId?: string | null;
  destinatario?: Record<string, unknown>;
  transportista?: Record<string, unknown> | null;
  observaciones?: string | null;
  idempotencyKey?: string;
  ambiente?: string;
}

export interface FacturaLineaFixture {
  id: string;
  cantidad: number;
  descripcion: string;
}

export interface FacturaFixture {
  facturaId: string;
  lineas: FacturaLineaFixture[];
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

/** Fecha calendario actual (o desplazada) en hora argentina, formato YYYY-MM-DD. */
export function fechaArgentina(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${parts}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Fixture: configuración fiscal del emisor (sin credenciales ARCA). */
export async function dadaUnaConfiguracionFiscal(
  overrides: Record<string, unknown> = {},
  tenantId: string = SEED.tenantId,
): Promise<void> {
  const { error } = await adminClient.from("facturacion_configuracion_ambiente").upsert({
    tenant_id: tenantId,
    ambiente: AMBIENTE,
    razon_social: "Taller Remitos SRL",
    nombre_fantasia: "Taller Remitos",
    cuit: "20123456786",
    condicion_iva_emisor: "RESPONSABLE_INSCRIPTO",
    domicilio: "Av. Siempreviva 742",
    ingresos_brutos: "901-123456-7",
    inicio_actividades: "2020-01-01",
    punto_venta: 1,
    ...overrides,
  }, { onConflict: "tenant_id,ambiente" });

  if (error) throw new Error(`dadaUnaConfiguracionFiscal falló: ${error.message}`);
}

/** Configuración R mínima válida (autoimpresor, CAI vigente por 30 días). */
export function configuracionRValida(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    r_cai: "71234567890123",
    r_cai_vencimiento: fechaArgentina(30),
    r_punto_emision: 1,
    r_autoimpresor: true,
    ...overrides,
  };
}

/** Fixture: configuración de remitos del tenant (upsert directo como service role). */
export async function dadaUnaConfiguracionRemitos(
  overrides: Record<string, unknown> = {},
  tenantId: string = SEED.tenantId,
): Promise<void> {
  const { error } = await adminClient.from("remitos_configuracion").upsert({
    tenant_id: tenantId,
    ambiente: AMBIENTE,
    ...overrides,
  }, { onConflict: "tenant_id,ambiente" });

  if (error) throw new Error(`dadaUnaConfiguracionRemitos falló: ${error.message}`);
}

/**
 * Fixture: factura autorizada con líneas. Se inserta en ENVIANDO, se cargan las líneas y
 * recién después se autoriza, porque el trigger fiscal bloquea agregar líneas a una factura autorizada.
 */
export async function dadaUnaFacturaAutorizadaConLineas(
  lineas: Array<{ cantidad: number; descripcion?: string; codigo?: string; origen?: string }>,
  options: {
    estado?: string;
    ambiente?: string;
    documentoTipo?: "FACTURA" | "NOTA_CREDITO";
    documentoAsociadoId?: string;
    arregloId?: string;
  } = {},
): Promise<FacturaFixture> {
  const arregloId = options.arregloId ?? (await dadoUnArreglo()).id;
  const documentoTipo = options.documentoTipo ?? "FACTURA";
  const { data: factura, error } = await adminClient
    .from("facturas_electronicas")
    .insert({
      tenant_id: SEED.tenantId,
      arreglo_id: arregloId,
      idempotency_key: randomUUID(),
      estado: "ENVIANDO",
      ambiente: options.ambiente ?? AMBIENTE,
      origen_tipo: "ARREGLO",
      documento_tipo: documentoTipo,
      documento_asociado_id: options.documentoAsociadoId ?? null,
      clase_comprobante: "C",
      concepto: 1,
      fecha_comprobante: fechaArgentina(),
      moneda: "PES",
      total: 99999,
      punto_venta: 1,
      tipo_comprobante: documentoTipo === "FACTURA" ? 11 : 13,
      numero_comprobante: Math.floor(Math.random() * 90_000_000) + 1_000_000,
      cae: "12345678901234",
      cae_vencimiento: fechaArgentina(10),
      emisor_snapshot: { razonSocial: "Taller Remitos SRL", cuit: "20123456786" },
      receptor_snapshot: {
        clienteId: SEED.clienteId,
        nombre: "Cliente Factura",
        domicilio: "Calle Falsa 123",
        tipoDocumento: 96,
        numeroDocumento: "30111222",
        condicionIvaReceptorId: 5,
      },
    })
    .select("id")
    .single();

  if (error || !factura) {
    throw new Error(`dadaUnaFacturaAutorizadaConLineas falló: ${error?.message ?? "sin respuesta"}`);
  }

  const rows = lineas.map((linea, index) => ({
    factura_id: factura.id,
    ordinal: index + 1,
    origen: linea.origen ?? "REPUESTO",
    descripcion: linea.descripcion ?? `Repuesto ${index + 1}`,
    codigo: linea.codigo ?? `REP-${index + 1}`,
    cantidad: linea.cantidad,
    importe_unitario: 1000,
    subtotal: 1000 * linea.cantidad,
    importe_neto: 1000 * linea.cantidad,
    importe_total: 1000 * linea.cantidad,
  }));
  const { data: insertedLines, error: linesError } = await adminClient
    .from("facturas_electronicas_lineas")
    .insert(rows)
    .select("id, cantidad, descripcion, ordinal")
    .order("ordinal");

  if (linesError || !insertedLines) {
    throw new Error(`dadaUnaFacturaAutorizadaConLineas falló al insertar líneas: ${linesError?.message}`);
  }

  const { error: updateError } = await adminClient
    .from("facturas_electronicas")
    .update({ estado: options.estado ?? "AUTORIZADA", autorizada_at: new Date().toISOString() })
    .eq("id", factura.id);

  if (updateError) {
    throw new Error(`dadaUnaFacturaAutorizadaConLineas falló al autorizar: ${updateError.message}`);
  }

  return {
    facturaId: factura.id,
    lineas: insertedLines.map((linea) => ({
      id: linea.id,
      cantidad: Number(linea.cantidad),
      descripcion: linea.descripcion,
    })),
  };
}

/** Fixture: segundo tenant con su propia configuración fiscal, para pruebas de aislamiento. */
export async function dadoOtroTenantConConfiguracionFiscal(): Promise<string> {
  const tenantId = randomUUID();
  const { error } = await adminClient.from("tenants").insert({ id: tenantId, nombre: "Otro taller", plan_sub: "PRO" });
  if (error) throw new Error(`dadoOtroTenantConConfiguracionFiscal falló: ${error.message}`);
  await dadaUnaConfiguracionFiscal({}, tenantId);
  return tenantId;
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

export function lineaLibre(overrides: Partial<LineaRemitoInput> = {}): LineaRemitoInput {
  return { codigo: "COD-1", descripcion: "Neumático 195/65 R15", observaciones: null, cantidad: 1, ...overrides };
}

export async function cuandoSeEmiteUnRemito(
  args: EmitirRemitoArgs,
  client: SupabaseClient = testClient,
) {
  const lineas = args.lineas ?? [lineaLibre()];
  const facturaLineaIds = [...new Set(lineas.flatMap((linea) => linea.factura_linea_id ? [linea.factura_linea_id] : []))];
  const referenciasResult = facturaLineaIds.length
    ? await adminClient.from("facturas_electronicas_lineas").select("id, codigo, descripcion").in("id", facturaLineaIds)
    : null;
  if (referenciasResult?.error) {
    throw new Error(`cuandoSeEmiteUnRemito no pudo leer líneas de factura: ${referenciasResult.error.message}`);
  }
  const porId = new Map((referenciasResult?.data ?? []).map((linea) => [linea.id, linea]));
  const lineasPayload = lineas.map((linea) => {
    const referencia = linea.factura_linea_id ? porId.get(linea.factura_linea_id) : null;
    return {
      ...linea,
      codigo: linea.codigo ?? referencia?.codigo ?? null,
      descripcion: linea.descripcion ?? referencia?.descripcion ?? "",
    };
  });
  return client.rpc("rpc_remitos_emitir", {
    p_idempotency_key: args.idempotencyKey ?? randomUUID(),
    p_ambiente: args.ambiente ?? AMBIENTE,
    p_clase: args.clase,
    p_arreglo_id: args.arregloId ?? null,
    p_factura_id: args.facturaId ?? null,
    p_destinatario: args.destinatario ?? {
      nombre: "Juan Pérez",
      domicilio: "Calle 1",
      tipoDocumento: 96,
      numeroDocumento: "30111222",
      condicionIvaReceptorId: 5,
    },
    p_transportista: args.transportista ?? null,
    p_observaciones: args.observaciones ?? null,
    p_lineas: lineasPayload,
  });
}

/** Emite un remito y devuelve su id, fallando el test si la emisión no fue aceptada. */
export async function dadoUnRemitoEmitido(args: EmitirRemitoArgs, client: SupabaseClient = testClient): Promise<string> {
  const { data, error } = await cuandoSeEmiteUnRemito(args, client);
  if (error || typeof data !== "string") {
    throw new Error(`dadoUnRemitoEmitido falló: ${error?.message ?? "sin respuesta"}`);
  }
  return data;
}

export async function cuandoSeAsociaUnaFactura(
  remitoId: string,
  facturaId: string,
  lineas: Array<{ remito_linea_id: string; factura_linea_id: string }>,
  client: SupabaseClient = testClient,
) {
  return client.rpc("rpc_remitos_asociar_factura", {
    p_remito_id: remitoId,
    p_factura_id: facturaId,
    p_lineas: lineas,
  });
}

// ─── Lecturas y aserciones ────────────────────────────────────────────────────

export async function leerRemito(remitoId: string) {
  const { data, error } = await adminClient.from("remitos").select("*").eq("id", remitoId).single();
  if (error || !data) throw new Error(`leerRemito falló: ${error?.message ?? "sin respuesta"}`);
  return data as Record<string, unknown>;
}

export async function leerLineasRemito(remitoId: string) {
  const { data, error } = await adminClient
    .from("remitos_lineas")
    .select("*")
    .eq("remito_id", remitoId)
    .order("ordinal");
  if (error || !data) throw new Error(`leerLineasRemito falló: ${error?.message ?? "sin respuesta"}`);
  return data as Array<Record<string, unknown>>;
}

export async function leerConfiguracionRemitos(tenantId: string = SEED.tenantId) {
  const { data, error } = await adminClient
    .from("remitos_configuracion")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ambiente", AMBIENTE)
    .maybeSingle();
  if (error) throw new Error(`leerConfiguracionRemitos falló: ${error.message}`);
  return data as Record<string, unknown> | null;
}

export async function contarFilas(tabla: "facturas_electronicas" | "facturacion_emision_intentos"): Promise<number> {
  const { count, error } = await adminClient.from(tabla).select("id", { count: "exact", head: true });
  if (error) throw new Error(`contarFilas(${tabla}) falló: ${error.message}`);
  return count ?? 0;
}

export function expectErrorDeNegocio(error: { message?: string; code?: string } | null, mensaje: string | RegExp) {
  expect(error).not.toBeNull();
  if (typeof mensaje === "string") {
    expect(error?.message).toContain(mensaje);
  } else {
    expect(error?.message).toMatch(mensaje);
  }
}

export { adminClient };
