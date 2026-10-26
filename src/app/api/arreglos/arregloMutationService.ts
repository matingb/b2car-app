import { IVA_RATE } from "@/lib/ivaRate";
import { Permission } from "@/lib/permissions";
import { hasUserPermission } from "@/lib/permissions.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Arreglo, EstadoArreglo } from "@/model/types";
import { ESTADOS_ARREGLO } from "@/model/types";
import { ServiceError } from "@/app/api/serviceError";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { logger } from "@/lib/logger";
import { arregloService } from "./arregloService";
import { arregloFormularioService } from "./arregloFormularioService";
import type {
  CreateArregloDetalleFormularioInput,
  UpdateArregloRequest,
} from "./arregloRequests";

export type MutationResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

export function mapActivacionPresupuestoError(error: unknown): { status: number; message: string } {
  const raw = String((error as { message?: unknown } | null)?.message ?? "");
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  const lower = raw.toLowerCase();

  if (raw.includes("PRECIO_COMPRA_REQUERIDO")) {
    const faltante = /faltante=(\d+)/.exec(raw)?.[1];
    const unidades = faltante ? `${faltante} ${faltante === "1" ? "unidad" : "unidades"}` : "unidades";
    return {
      status: 400,
      message: `No hay stock suficiente de un repuesto del presupuesto (faltan ${unidades}). ` +
        "Cargale un precio de compra y una cuenta financiera para registrar la compra automática, o ajustá el stock antes de activar.",
    };
  }
  if (raw.includes("CUENTA_FINANCIERA_REQUERIDA") || lower.includes("cuenta financiera requerida") || lower.includes("cuenta_id requerido")) {
    return {
      status: 400,
      message: "Un repuesto del presupuesto requiere una compra automática. Editalo y seleccioná una cuenta financiera para registrarla.",
    };
  }
  if (raw.includes("IDEMPOTENCY_KEY_REQUERIDA")) {
    return {
      status: 400,
      message: "Un repuesto del presupuesto requiere una compra automática sin datos de compra completos. Volvé a guardarlo con su precio de compra y cuenta financiera.",
    };
  }
  if (raw.includes("STOCK_INSUFICIENTE") || lower.includes("stock insuficiente")) {
    return {
      status: 409,
      message: "No hay stock suficiente para los repuestos del presupuesto. Revisá las cantidades o el stock disponible.",
    };
  }
  if (raw.includes("stock_id no pertenece al taller") || lower.includes("stock no encontrado")) {
    return {
      status: 400,
      message: "Un repuesto del presupuesto ya no existe en el inventario del taller.",
    };
  }
  if (raw.includes("PRODUCTO_CODIGO_DUPLICADO") || raw.includes("uq_productos_tenant_codigo")) {
    return {
      status: 409,
      message: "Un repuesto nuevo del presupuesto usa un código que ya existe. Reemplazalo por el producto existente desde el listado.",
    };
  }
  if (raw.includes("ya fue activado")) {
    return { status: 409, message: "El presupuesto ya fue activado con otro estado. Recargá la página." };
  }
  if (raw.includes("Estado de activacion invalido")) {
    return { status: 400, message: "El estado elegido no es válido para activar el presupuesto." };
  }
  if (lower.includes("arreglo no encontrado")) {
    return { status: 404, message: "Arreglo no encontrado" };
  }
  if (raw.includes("JWT sin tenant_id") || code === "28000") {
    return { status: 401, message: "Tu sesión expiró. Volvé a iniciar sesión." };
  }
  if (code === "42501" || lower.includes("permission denied")) {
    return { status: 403, message: "No tenés permisos para realizar esta acción." };
  }
  if (code === "22023" || /inv[aá]lid[oa]/i.test(raw)) {
    return {
      status: 400,
      message: "Hay un repuesto del presupuesto con datos inválidos (cantidad, precio o código). Revisalo antes de activar.",
    };
  }
  return { status: 500, message: "No se pudo activar el presupuesto. Intentá nuevamente." };
}

export const arregloMutationService = {
  async validateEstadoTransition(
    supabase: SupabaseClient,
    arregloId: string,
    patchEstado: EstadoArreglo,
    cachedArreglo?: Arreglo | null,
    incomingDetalleForm?: CreateArregloDetalleFormularioInput
  ): Promise<{
    currentArreglo: Arreglo | null;
    error: string | null;
    status: number;
  }> {
    let currentArreglo = cachedArreglo ?? null;

    const ensureCurrentArreglo = async () => {
      if (currentArreglo) return { data: currentArreglo, error: null };
      const { data, error } = await arregloService.getByIdWithVehiculo(supabase, arregloId);
      if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
        return { data: null, error: message, status };
      }
      currentArreglo = data;
      return { data, error: null };
    };

    if (!currentArreglo && patchEstado !== "PRESUPUESTO" && patchEstado !== "TERMINADO") {
      const fetchResult = await ensureCurrentArreglo();
      if (fetchResult.error) {
        return { currentArreglo: null, error: fetchResult.error, status: fetchResult.status ?? 500 };
      }
    }

    if (patchEstado === "PRESUPUESTO") {
      const fetchResult = await ensureCurrentArreglo();
      if (fetchResult.error) {
        return { currentArreglo: null, error: fetchResult.error, status: fetchResult.status ?? 500 };
      }

      if (currentArreglo?.estado !== "PRESUPUESTO") {
        return {
          currentArreglo,
          error: "No se puede volver a PRESUPUESTO despues de activar el arreglo",
          status: 409,
        };
      }
    }

    if (patchEstado === "TERMINADO") {
      const fetchResult = await ensureCurrentArreglo();
      if (fetchResult.error) {
        return { currentArreglo: null, error: fetchResult.error, status: fetchResult.status ?? 500 };
      }

      const isTransitionToTerminado =
        String(currentArreglo?.estado ?? "").trim().toUpperCase() !== "TERMINADO";

      if (isTransitionToTerminado) {
        const validation = await arregloFormularioService.validateTerminadoRequiredFields(
          supabase,
          arregloId,
          incomingDetalleForm
        );

        if (!validation.ok) {
          return {
            currentArreglo,
            error: validation.error,
            status: validation.status,
          };
        }
      }
    }

    return { currentArreglo, error: null, status: 200 };
  },

  async updateArregloCompleto(
    supabase: SupabaseClient,
    id: string,
    payload: UpdateArregloRequest
  ): Promise<MutationResult<Arreglo>> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { data: null, error: "JSON inválido", status: 400 };
    if (["tasa_iva", "precio_final", "precio_sin_iva", "total_cobrado", "saldo_pendiente"].some(key => Object.prototype.hasOwnProperty.call(payload, key))) return { data: null, error: "Los importes y la tasa IVA se calculan en el servidor", status: 400 };
    const hasIva = Object.prototype.hasOwnProperty.call(payload, "precios_incluyen_iva");
    if (hasIva && typeof payload.precios_incluyen_iva !== "boolean") return { data: null, error: "precios_incluyen_iva debe ser boolean", status: 400 };
    if (hasIva && !await hasUserPermission(supabase, Permission.ArreglosPreciosEdit)) return { data: null, error: "Sin permiso para editar precios", status: 403 };
    if (Object.prototype.hasOwnProperty.call(payload, "esta_pago")) {
      return {
        data: null,
        error: "El cobro se registra desde la acción de pago para conservar el asiento financiero.",
        status: 400,
      };
    }

    if (Object.prototype.hasOwnProperty.call(payload, "combustible_leido")) {
      const combustibleLeido = payload.combustible_leido;
      if (
        combustibleLeido !== null &&
        combustibleLeido !== undefined &&
        (!Number.isInteger(combustibleLeido) || combustibleLeido < 0 || combustibleLeido > 100)
      ) {
        return {
          data: null,
          error: "combustible_leido debe ser un porcentaje entre 0 y 100",
          status: 400,
        };
      }
    }

    const { detalle_formulario, ...restPayload } = payload;
    const arregloPatch: UpdateArregloRequest & { tasa_iva?: number } = {};
    for (const key of ["estado", "kilometraje_leido", "combustible_leido", "fecha", "observaciones", "es_facturable", "cliente_id", "extra_data", "precios_incluyen_iva"] as const) {
      if (Object.prototype.hasOwnProperty.call(restPayload, key)) Object.assign(arregloPatch, { [key]: restPayload[key] });
    }
    delete (arregloPatch as { descripcion?: unknown }).descripcion;

    if (arregloPatch.estado !== undefined) {
      const estado = String(arregloPatch.estado ?? "").trim().toUpperCase();
      if (!(ESTADOS_ARREGLO as string[]).includes(estado)) {
        return { data: null, error: "Estado de arreglo inválido", status: 400 };
      }
      arregloPatch.estado = estado as EstadoArreglo;
    }

    let currentArreglo: Arreglo | null = null;
    if (hasIva) {
      const current = await arregloService.getByIdWithVehiculo(supabase, id);
      if (current.error || !current.data) return { data: null, error: "Arreglo no encontrado", status: current.error === ServiceError.NotFound || !current.data ? 404 : 500 };
      currentArreglo = current.data;
      if (payload.precios_incluyen_iva !== (currentArreglo.precios_incluyen_iva ?? true)) {
        if (Number(currentArreglo.total_cobrado ?? 0) > 0 || currentArreglo.esta_pago) return { data: null, error: "No se puede cambiar IVA con cobros vigentes", status: 409 };
        // DB rechecks guards and computes totals atomically under the arreglo lock.
        arregloPatch.tasa_iva = IVA_RATE;
      }
    }
    let activateAfterPatch = false;
    let activationTarget: EstadoArreglo | undefined;

    if (arregloPatch.estado) {
      const transitionResult = await this.validateEstadoTransition(
        supabase,
        id,
        arregloPatch.estado,
        currentArreglo,
        detalle_formulario
      );

      currentArreglo = transitionResult.currentArreglo;
      if (transitionResult.error) {
        return {
          data: null,
          error: transitionResult.error,
          status: transitionResult.status,
        };
      }
      activateAfterPatch =
        currentArreglo?.estado === "PRESUPUESTO" &&
        arregloPatch.estado !== "PRESUPUESTO";
      if (activateAfterPatch) activationTarget = arregloPatch.estado;
    }

    if (activateAfterPatch) {
      delete arregloPatch.estado;
    }

    const patchEntries = Object.entries(arregloPatch).filter(([, value]) => value !== undefined);

    let updatedArreglo: Arreglo | null = null;
    if (patchEntries.length > 0) {
      const { data, error, cause } = await arregloService.updateById(
        supabase,
        id,
        arregloPatch
      );

      if (error) {
        const forbidden = cause?.code === "42501";
        const conflict = error === ServiceError.ArregloFacturado || error === ServiceError.MovimientoFinancieroInmutable || error === ServiceError.Conflict || cause?.code === "P1971" || cause?.code === "P1972";
        const status = forbidden ? 403 : conflict ? 409 : error === ServiceError.NotFound ? 404 : 500;
        return { data: null, error: forbidden ? "Sin permiso para editar precios" : conflict ? "No se puede cambiar IVA: cobros o documentación fiscal protegida" : status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo", status };
      }

      updatedArreglo = data;
    } else {
      if (currentArreglo) {
        updatedArreglo = currentArreglo;
      } else {
        const { data: fetchedArreglo, error: currentError } = await arregloService.getByIdWithVehiculo(
          supabase,
          id
        );

        if (currentError) {
          const status = currentError === ServiceError.NotFound ? 404 : 500;
          const message = status === 404 ? "Arreglo no encontrado" : "Error actualizando arreglo";
          return { data: null, error: message, status };
        }

        updatedArreglo = fetchedArreglo;
      }
    }

    if (detalle_formulario) {
      const formUpsertResult = await arregloFormularioService.upsertDetalleFormulario(
        supabase,
        id,
        detalle_formulario
      );

      if (formUpsertResult.error) {
        return {
          data: null,
          error: formUpsertResult.error,
          status: formUpsertResult.status ?? 500,
        };
      }
    }

    if (detalle_formulario) {
      const refreshed = await arregloService.getByIdWithVehiculo(supabase, id);
      if (refreshed.error) return { data: null, error: "No se pudo recargar el arreglo", status: 500 };
      updatedArreglo = refreshed.data;
    }

    if (activateAfterPatch && activationTarget !== undefined) {
      const { error: activationError } = await supabase.rpc("rpc_activar_presupuesto", {
        p_arreglo_id: id,
        p_nuevo_estado: activationTarget,
      });

      if (activationError) {
        logger.error("Error rpc_activar_presupuesto:", activationError, {
          arreglo_id: id,
          nuevo_estado: activationTarget,
        });
        const mapped = mapActivacionPresupuestoError(activationError);
        return { data: null, error: mapped.message, status: mapped.status };
      }

      const { data: activated, error: activatedError } = await arregloService.getByIdWithVehiculo(supabase, id);
      if (activatedError || !activated) {
        return { data: null, error: "El presupuesto se activo, pero no se pudo cargar", status: 500 };
      }
      updatedArreglo = activated;
    }

    await statsService.onDataChanged(
      supabase,
      (updatedArreglo as { tenant_id?: string | null } | null)?.tenant_id
    );

    return { data: updatedArreglo, error: null, status: 200 };
  },

  async deleteArregloCompleto(
    supabase: SupabaseClient,
    id: string
  ): Promise<{ error: string | null; status: number }> {
    if (!id) {
      return { error: "ID de arreglo no proporcionado", status: 400 };
    }

    const { data: currentArreglo, error: currentError } = await arregloService.getByIdWithVehiculo(
      supabase,
      id
    );

    if (currentError) {
      const status = currentError === ServiceError.NotFound ? 404 : 500;
      const message = status === 404 ? "Arreglo no encontrado" : "Error eliminando arreglo";
      return { error: message, status };
    }

    const { error, message } = await arregloService.deleteById(supabase, id);

    if (error) {
      if (error === ServiceError.ArregloFacturado) {
        return {
          error: message || "El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar",
          status: 409,
        };
      }

      const status = error === ServiceError.NotFound ? 404 : 500;
      const errorMessage = status === 404 ? "Arreglo no encontrado" : (message || "Error eliminando arreglo");
      return { error: errorMessage, status };
    }

    await statsService.onDataChanged(
      supabase,
      (currentArreglo as { tenant_id?: string | null } | null)?.tenant_id
    );

    return { error: null, status: 200 };
  },
};
