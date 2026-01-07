import { logger } from "@/lib/logger";
import { Arreglo } from "@/model/types"
import { createClient } from "@/supabase/server"
import { IVA_RATE } from "@/lib/ivaRate";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { ArregloServiceError, arregloService } from "@/app/api/arreglos/arregloService";
import type { CreateArregloInsertPayload, CreateArregloRequest } from "./arregloRequests";

export type GetArreglosResponse = {
    data: Arreglo[] | null;
    error?: string | null;
};

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await arregloService.listAll(supabase)
    if (error) {
        const status = error === ArregloServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglos no encontrados" : "Error cargando arreglos";
        return Response.json({ data: [], error: message }, { status })
    }

    logger.debug("GET /api/arreglos - data:", data, "error:", error);

    const arreglos: Arreglo[] = (data ?? []).map(arreglo => ({
        id: arreglo.id,
        vehiculo: arreglo.vehiculo,
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
        tipo,
        descripcion,
        kilometraje_leido,
        fecha,
        observaciones,
        precio_final,
        esta_pago,
        extra_data,
    } = body as CreateArregloRequest

    if (!vehiculo_id) return Response.json({ error: "Falta vehiculo_id" }, { status: 400 });
    if (!fecha) return Response.json({ error: "Falta fecha" }, { status: 400 });

    const ivaRate = IVA_RATE
    const computedSinIva = Number((Number(precio_final) / (1 + ivaRate)).toFixed(2));

    const insertPayload: CreateArregloInsertPayload = {
        vehiculo_id,
        tipo,
        descripcion: descripcion ?? null,
        kilometraje_leido,
        fecha,
        observaciones: observaciones ?? null,
        precio_final,
        precio_sin_iva: computedSinIva,
        esta_pago: typeof esta_pago === 'boolean' ? esta_pago : false,
        extra_data: extra_data ?? null,
    };

    const { data: insertData, error: insertError } = await arregloService.create(supabase, insertPayload);
    if (insertError) {
        const status = insertError === ArregloServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglo no encontrado" : "Error creando arreglo";
        return Response.json({ error: message }, { status });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: insertData, error: null }, { status: 201 });
}
