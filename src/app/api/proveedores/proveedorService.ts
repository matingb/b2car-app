import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { ServiceError } from "@/app/api/serviceError";
import { isValidUuid } from "@/lib/uuid";
import type { ProveedorMovimientoCuenta, SentidoMovimientoCuentaCorriente } from "@/model/types";
import {
  type CreateProveedorPayload,
  type ListProveedoresFilters,
  type ProveedorExtractoFilters,
  type ProveedorRepository,
  type ProveedorRow,
  type UpdateProveedorPayload,
  supabaseProveedorRepository,
} from "./proveedorRepository";

export type { ProveedorRow, ListProveedoresFilters, ProveedorExtractoFilters, ProveedorRepository };

export type CreateProveedorInput = {
  nombre: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export type UpdateProveedorInput = {
  nombre?: string;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

export type CreatePagoDirectoProveedorInput = {
  sentido?: SentidoMovimientoCuentaCorriente;
  cuentaId?: string;
  monto?: number;
  fecha?: string;
  descripcion?: string | null;
  idempotencyKey?: string | null;
  observaciones?: string | null;
  tallerId?: string | null;
  pagos?: Array<{
    cuentaId: string;
    monto: number;
    fecha?: string;
    descripcion?: string;
    idempotencyKey?: string;
  }>;
};

function cleanString(val?: string | null): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createProveedorService(repository: ProveedorRepository) {
  return {
    async list(
      supabase: SupabaseClient,
      filters?: ListProveedoresFilters
    ): Promise<{ data: ProveedorRow[]; error: ServiceError | null; cause?: PostgrestError }> {
      const res = await repository.list(supabase, filters);
      if (res.error || !res.data || res.data.length === 0 || typeof repository.getSaldos !== "function") {
        return res;
      }

      try {
        const saldosRes = await repository.getSaldos(
          supabase,
          res.data.map((p) => p.id)
        );
        const saldosMap = saldosRes.data;
        if (!saldosMap) return res;

        const enriched = res.data.map((p) => ({
          ...p,
          saldo_pendiente: saldosMap.get(p.id)?.saldoPendiente ?? 0,
        }));
        return { data: enriched, error: null };
      } catch {
        return res;
      }
    },

    async getById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      return repository.getById(supabase, id);
    },

    async create(
      supabase: SupabaseClient,
      payload: CreateProveedorInput
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      const dbPayload: CreateProveedorPayload = {
        nombre: payload.nombre.trim(),
        cuit: cleanString(payload.cuit),
        telefono: cleanString(payload.telefono),
        email: cleanString(payload.email),
        direccion: cleanString(payload.direccion),
      };

      return repository.create(supabase, dbPayload);
    },

    async updateById(
      supabase: SupabaseClient,
      id: string,
      patch: UpdateProveedorInput
    ): Promise<{ data: ProveedorRow | null; error: ServiceError | PostgrestError | null }> {
      const payload: UpdateProveedorPayload = {};

      if (patch.nombre !== undefined) {
        payload.nombre = patch.nombre.trim();
      }
      if (patch.cuit !== undefined) {
        payload.cuit = cleanString(patch.cuit);
      }
      if (patch.telefono !== undefined) {
        payload.telefono = cleanString(patch.telefono);
      }
      if (patch.email !== undefined) {
        payload.email = cleanString(patch.email);
      }
      if (patch.direccion !== undefined) {
        payload.direccion = cleanString(patch.direccion);
      }

      return repository.updateById(supabase, id, payload);
    },

    async deleteById(
      supabase: SupabaseClient,
      id: string
    ): Promise<{ error: ServiceError | PostgrestError | null }> {
      return repository.deleteById(supabase, id);
    },

    async getCuentaCorriente(
      supabase: SupabaseClient,
      proveedorId: string
    ) {
      const hasExtracto = typeof repository.getExtractoCuentaCorriente === "function";
      const [resumenRes, extractoRes] = await Promise.all([
        repository.getCuentaCorriente(supabase, proveedorId),
        hasExtracto
          ? repository.getExtractoCuentaCorriente!(supabase, proveedorId, {})
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (resumenRes.error || !resumenRes.data) {
        return resumenRes;
      }
      if (!hasExtracto || extractoRes.error || !Array.isArray(extractoRes.data)) {
        return resumenRes;
      }

      const sortedAsc = [...extractoRes.data].sort(
        (a, b) =>
          Date.parse(a.fecha as string) - Date.parse(b.fecha as string) ||
          Date.parse((a.created_at ?? a.fecha) as string) - Date.parse((b.created_at ?? b.fecha) as string) ||
          (Number(b.debito) > 0 ? 1 : 0) - (Number(a.debito) > 0 ? 1 : 0)
      );

      let runningBalance = 0;
      const movimientos: ProveedorMovimientoCuenta[] = sortedAsc
        .map((row) => {
          const debito = Number(row.debito ?? 0);
          const credito = Number(row.credito ?? 0);
          runningBalance += debito - credito;
          return {
            id: String(row.id),
            fecha: String(row.fecha),
            created_at: String(row.created_at ?? row.fecha),
            tipo_movimiento: String(row.tipo_movimiento),
            concepto: String(row.concepto ?? ""),
            comprobante: row.comprobante ? String(row.comprobante) : null,
            debito,
            credito,
            saldo_acumulado: runningBalance,
            operacion_id: row.operacion_id ? String(row.operacion_id) : null,
            cuenta_nombre: row.cuenta_nombre ? String(row.cuenta_nombre) : null,
          };
        })
        .reverse();

      return {
        data: {
          ...resumenRes.data,
          movimientos,
        },
        error: null,
      };
    },

    async createPagoDirecto(
      supabase: SupabaseClient,
      proveedorId: string,
      input: CreatePagoDirectoProveedorInput
    ): Promise<{ data: string | null; error: ServiceError | PostgrestError | null }> {
      if (!proveedorId || !isValidUuid(proveedorId)) {
        return { data: null, error: ServiceError.Validation };
      }
      if (input.sentido !== undefined && input.sentido !== "PAGO" && input.sentido !== "COBRO") {
        return { data: null, error: ServiceError.Validation };
      }

      const sentidoProps = input.sentido ? { sentido: input.sentido } : {};
      const hasPagosArray = Array.isArray(input.pagos) && input.pagos.length > 0;

      if (hasPagosArray) {
        let total = 0;
        for (const p of input.pagos!) {
          if (!p.cuentaId || !isValidUuid(p.cuentaId)) {
            return { data: null, error: ServiceError.Validation };
          }
          if (typeof p.monto !== "number" || p.monto <= 0) {
            return { data: null, error: ServiceError.Validation };
          }
          total += p.monto;
        }

        return repository.createPagoDirecto(supabase, {
          proveedor_id: proveedorId,
          ...sentidoProps,
          cuenta_id: input.pagos![0].cuentaId,
          monto: total,
          fecha: input.fecha,
          descripcion: input.descripcion ? input.descripcion.trim() : null,
          idempotency_key: input.idempotencyKey ?? null,
          observaciones: input.observaciones ? input.observaciones.trim() : null,
          taller_id: input.tallerId ?? null,
          pagos: input.pagos!.map((p) => ({
            cuenta_id: p.cuentaId,
            monto: p.monto,
            fecha: p.fecha,
            descripcion: p.descripcion ? p.descripcion.trim() : undefined,
            idempotency_key: p.idempotencyKey,
          })),
        });
      }

      if (!input.cuentaId || !isValidUuid(input.cuentaId)) {
        return { data: null, error: ServiceError.Validation };
      }
      if (!input.monto || typeof input.monto !== "number" || input.monto <= 0) {
        return { data: null, error: ServiceError.Validation };
      }

      return repository.createPagoDirecto(supabase, {
        proveedor_id: proveedorId,
        ...sentidoProps,
        cuenta_id: input.cuentaId,
        monto: input.monto,
        fecha: input.fecha,
        descripcion: input.descripcion ? input.descripcion.trim() : null,
        idempotency_key: input.idempotencyKey ?? null,
        observaciones: input.observaciones ? input.observaciones.trim() : null,
        taller_id: input.tallerId ?? null,
      });
    },
  };
}

export const proveedorService = createProveedorService(supabaseProveedorRepository);
