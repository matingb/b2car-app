import { logger } from "@/lib/logger";
import { Arreglo } from "@/model/types"
import { createClient } from "@/supabase/server"
import { IVA_RATE } from "@/lib/ivaRate";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type { CreateArregloInsertPayload, CreateArregloRequest } from "./arregloRequests";
import type { NextRequest } from "next/server";
import { ServiceError } from "../serviceError";
import { detalleArregloService } from "@/app/api/arreglos/detalleArregloService";

export type GetArreglosResponse = {
    data: Arreglo[] | null;
    error?: string | null;
};

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const tallerId = req.nextUrl.searchParams.get("taller_id") ?? undefined;
    const { data, error } = await arregloService.listAll(supabase, { tallerId })
    if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglos no encontrados" : "Error cargando arreglos";
        return Response.json({ data: [], error: message }, { status })
    }

    logger.debug("GET /api/arreglos - data:", data, "error:", error);

    const arreglos: Arreglo[] = (data ?? []).map(arreglo => ({
        id: arreglo.id,
        vehiculo: arreglo.vehiculo,
        taller_id: arreglo.taller_id,
        taller: arreglo.taller,
        tipo: arreglo.tipo,
        descripcion: arreglo.descripcion,
        kilometraje_leido: arreglo.kilometraje_leido,
        fecha: arreglo.fecha,
        observaciones: arreglo.observaciones,
        precio_final: arreglo.precio_final,
        precio_sin_iva: arreglo.precio_sin_iva,
        esta_pago: arreglo.esta_pago,
        extra_data: arreglo.extra_data,
    }));
    return Response.json({ data: arreglos })
}

export type CreateArregloResponse = {
    data: Arreglo | null;
    error?: string | null;
};

// POST /api/arreglos -> crear arreglo
export async function POST(req: Request) {
    const supabase = await createClient();
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

    const {
        vehiculo_id,
        taller_id,
        tipo,
        descripcion,
        kilometraje_leido,
        fecha,
        observaciones,
        precio_final,
        esta_pago,
        extra_data,
        detalles,
        repuestos,
    } = body as CreateArregloRequest

    if (!vehiculo_id) return Response.json({ error: "Falta vehiculo_id" }, { status: 400 });
    if (!taller_id) return Response.json({ error: "Falta taller_id" }, { status: 400 });
    if (!fecha) return Response.json({ error: "Falta fecha" }, { status: 400 });

    const precioFinalNumber = Number(precio_final) || 0;
    const kmNumber = Number(kilometraje_leido) || 0;
    const tipoValue = String(tipo ?? "").trim();

    const ivaRate = IVA_RATE
    const computedSinIva = Number((precioFinalNumber / (1 + ivaRate)).toFixed(2));

    const insertPayload: CreateArregloInsertPayload = {
        vehiculo_id,
        taller_id,
        tipo: tipoValue,
        descripcion: descripcion ?? null,
        kilometraje_leido: kmNumber,
        fecha,
        observaciones: observaciones ?? null,
        precio_final: precioFinalNumber,
        precio_sin_iva: computedSinIva,
        esta_pago: typeof esta_pago === 'boolean' ? esta_pago : false,
        extra_data: extra_data ?? null,
    };

    const { data: insertData, error: insertError } = await arregloService.create(supabase, insertPayload);
    if (insertError) {
        const status = insertError === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglo no encontrado" : "Error creando arreglo";
        return Response.json({ error: message }, { status });
    }

    // Opcional: crear líneas (servicios + repuestos) en el mismo POST.
    // Esto se usa principalmente desde el ArregloModal (crear).
    const arregloId = String((insertData as { id?: unknown })?.id ?? "");
    const tallerId = String(taller_id ?? "").trim();

    const detallesArr = Array.isArray(detalles) ? detalles : [];
    const repuestosArr = Array.isArray(repuestos) ? repuestos : [];

    // Repuestos: validar + pre-chequear stock (best-effort) para evitar parciales.
    if (repuestosArr.length > 0) {
        const normalized = repuestosArr.map((r) => ({
            stock_id: String((r as { stock_id?: unknown }).stock_id ?? "").trim(),
            cantidad: Number((r as { cantidad?: unknown }).cantidad),
            monto_unitario: Number((r as { monto_unitario?: unknown }).monto_unitario),
        }));

        for (const r of normalized) {
            if (!r.stock_id) return Response.json({ error: "Falta stock_id en repuestos" }, { status: 400 });
            if (!Number.isFinite(r.cantidad) || r.cantidad <= 0) return Response.json({ error: "Cantidad inválida en repuestos" }, { status: 400 });
            if (!Number.isFinite(r.monto_unitario) || r.monto_unitario < 0) return Response.json({ error: "Monto unitario inválido en repuestos" }, { status: 400 });
        }

        // No permitir duplicados por stock_id (la tabla es unique por (operacion_id, stock_id))
        const stockIdSet = new Set<string>();
        for (const r of normalized) {
            if (stockIdSet.has(r.stock_id)) {
                return Response.json({ error: "Repuestos duplicados (stock_id)" }, { status: 400 });
            }
            stockIdSet.add(r.stock_id);
        }

        const stockIds = Array.from(stockIdSet);
        const { data: stocksRows, error: stocksErr } = await supabase
            .from("stocks")
            .select("id, taller_id, cantidad")
            .in("id", stockIds);

        if (stocksErr) {
            return Response.json({ error: "Error validando stock" }, { status: 500 });
        }

        const stocksMap = new Map<string, { taller_id: string; cantidad: number }>();
        for (const s of (stocksRows ?? []) as Array<{ id: string; taller_id: string; cantidad: number }>) {
            stocksMap.set(String(s.id), {
                taller_id: String(s.taller_id ?? ""),
                cantidad: Number(s.cantidad ?? 0) || 0,
            });
        }

        for (const r of normalized) {
            const found = stocksMap.get(r.stock_id);
            if (!found) return Response.json({ error: "Stock no encontrado" }, { status: 400 });
            if (String(found.taller_id) !== tallerId) {
                return Response.json({ error: "El stock no pertenece al taller" }, { status: 400 });
            }
            if ((Number(found.cantidad) || 0) < r.cantidad) {
                return Response.json({ error: "Stock insuficiente" }, { status: 409 });
            }
        }

        for (const r of normalized) {
            const { error: rpcErr } = await supabase.rpc("rpc_set_asignacion_arreglo_linea", {
                p_arreglo_id: arregloId,
                p_taller_id: tallerId,
                p_stock_id: r.stock_id,
                p_cantidad: r.cantidad,
                p_monto_unitario: r.monto_unitario,
            });
            if (rpcErr) {
                const raw = String(rpcErr?.message ?? "");
                const isStock = raw.includes("STOCK_INSUFICIENTE");
                const status = isStock ? 409 : 500;
                const message = isStock ? "Stock insuficiente" : "Error guardando repuesto";
                return Response.json({ error: message }, { status });
            }
        }
    }

    // Servicios (detalle_arreglo)
    if (detallesArr.length > 0) {
        const normalized = detallesArr.map((d) => ({
            descripcion: String((d as { descripcion?: unknown }).descripcion ?? "").trim(),
            cantidad: Number((d as { cantidad?: unknown }).cantidad),
            valor: Number((d as { valor?: unknown }).valor),
        }));

        for (const d of normalized) {
            if (!d.descripcion) return Response.json({ error: "Falta descripción en servicios" }, { status: 400 });
            if (!Number.isFinite(d.cantidad) || d.cantidad <= 0) return Response.json({ error: "Cantidad inválida en servicios" }, { status: 400 });
            // UX: valor unitario mínimo 1 (según el modal)
            if (!Number.isFinite(d.valor) || d.valor <= 0) return Response.json({ error: "Valor inválido en servicios" }, { status: 400 });
        }

        for (const d of normalized) {
            const { error: detErr } = await detalleArregloService.create(supabase, {
                arreglo_id: arregloId,
                descripcion: d.descripcion,
                cantidad: d.cantidad,
                valor: d.valor,
            });
            if (detErr) {
                return Response.json({ error: "Error creando detalle del arreglo" }, { status: 500 });
            }
        }
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: insertData, error: null }, { status: 201 });
}
