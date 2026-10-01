import { Permission } from "@/lib/permissions";
import type { CrearCuentaFinancieraResponse, ListarCuentasFinancierasResponse } from "@/model/finanzas";
import { createApiHandler } from "../apiHandler";
import { parseInput, readJsonBody } from "../apiInput";
import { asRows, extractRpcId, mapCuenta, mapRows, validateCreateCuenta } from "./finanzasRouteUtils";

function firstCuenta(data: unknown) {
  return mapCuenta(asRows(data)[0]);
}

export const GET = createApiHandler(
  {
    route: "GET /api/cuentas-financieras",
    fallback: "Error listando cuentas financieras",
  },
  async (ctx) => {
    const { data, error } = await ctx.supabase.rpc("rpc_finanzas_listar_cuentas");
    if (error) return ctx.fail(error);

    const cuentas = mapRows(data, (row) => mapCuenta(row, { hideBalances: !ctx.can(Permission.FinanzasView) }));

    if (!cuentas) {
      return ctx.fail(new Error("Respuesta inválida al listar cuentas financieras"), {
        fallback: "Respuesta inválida al listar cuentas financieras",
      });
    }

    return Response.json({ data: cuentas, error: null } satisfies ListarCuentasFinancierasResponse);
  },
);

export const POST = createApiHandler(
  {
    route: "POST /api/cuentas-financieras",
    fallback: "Error creando cuenta financiera",
    permission: Permission.FinanzasEdit,
  },
  async (ctx) => {
    const input = parseInput(validateCreateCuenta, await readJsonBody(ctx.req));

    const { data: created, error } = await ctx.supabase.rpc("rpc_finanzas_crear_cuenta", {
      p_nombre: input.nombre,
      p_tipo: input.tipo,
      p_saldo_inicial: input.saldoInicial ?? 0,
      p_fecha: input.fecha ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    if (error) return ctx.fail(error);

    const inlineCuenta = firstCuenta(created);
    if (inlineCuenta) {
      return Response.json({ data: inlineCuenta, error: null } satisfies CrearCuentaFinancieraResponse, { status: 201 });
    }

    const id = extractRpcId(created);
    if (!id) return ctx.fail(new Error("Respuesta inválida al crear cuenta financiera"), {
      fallback: "Respuesta inválida al crear cuenta financiera",
    });

    const { data: fetched, error: fetchError } = await ctx.supabase.rpc("rpc_finanzas_obtener_cuenta", { p_cuenta_id: id });

    if (fetchError) return ctx.fail(fetchError, { fallback: "No se pudo recuperar la cuenta creada" });

    const cuenta = firstCuenta(fetched);

    if (!cuenta) return ctx.fail(new Error("No se pudo recuperar la cuenta creada"), {
      fallback: "No se pudo recuperar la cuenta creada",
    });
    
    return Response.json({ data: cuenta, error: null } satisfies CrearCuentaFinancieraResponse, { status: 201 });
  },
);
