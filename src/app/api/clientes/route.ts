import { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { clienteService, type ClienteListFilters } from "./clienteService";
import { normalizePaginationLimit } from "@/lib/pagination";
import type { Cliente } from "@/model/types";

export type GetClientesApiResponse = {
  data: Cliente[] | null;
  page: {
    hasMore: boolean;
  };
  error?: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const searchParams = req.nextUrl.searchParams;

  const toUndef = (value: string | null) => {
    const trimmed = String(value ?? "").trim();
    return trimmed ? trimmed : undefined;
  };

  const limitParam = searchParams.get("limit");
  const limit = limitParam !== null ? normalizePaginationLimit(limitParam) : 50;

  const rawTipo = toUndef(searchParams.get("tipo"));
  const tipo = rawTipo === "particular" || rawTipo === "empresa" ? rawTipo : undefined;

  const rawSaldo = toUndef(searchParams.get("saldo"))?.toUpperCase();
  const saldo =
    rawSaldo === "PENDIENTE" || rawSaldo === "AL_DIA" || rawSaldo === "A_FAVOR"
      ? rawSaldo
      : undefined;

  const filters: ClienteListFilters = {
    limit,
    search: toUndef(searchParams.get("search")),
    tipo,
    saldo,
  };

  const { data, error } = await clienteService.getClientes(supabase, filters);

  if (error) {
    logger.error("Error al obtener clientes paginados:", error);
    return Response.json(
      {
        data: [],
        page: { hasMore: false },
        error: error.message,
      },
      { status: 500 }
    );
  }

  return Response.json({
    data: data?.rows ?? [],
    page: { hasMore: Boolean(data?.hasMore) },
    error: null,
  });
}