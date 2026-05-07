import { logger } from "@/lib/logger";
import { Arreglo, ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types"
import { createClient } from "@/supabase/server"
import { IVA_RATE } from "@/lib/ivaRate";
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { arregloService } from "@/app/api/arreglos/arregloService";
import type { CreateArregloInsertPayload, CreateArregloRequest } from "./arregloRequests";
import type { NextRequest } from "next/server";
import { ServiceError } from "../serviceError";
import type { ArregloListFilters } from "./arregloRepository";
import { normalizePaginationLimit } from "@/lib/pagination";
import {
    buildTerminadoRequiredFieldsErrorMessage,
    findMissingRequiredCustomFormFields,
} from "@/lib/arreglosCustomFormRequired";
import { buildArregloDescripcion } from "@/lib/arreglos";

export type GetArreglosResponse = {
    data: Arreglo[] | null;
    page: {
        hasMore: boolean;
    };
    error?: string | null;
};

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const query = req.nextUrl.searchParams;
    const toUndef = (value: string | null) => {
        const trimmed = String(value ?? "").trim();
        return trimmed ? trimmed : undefined;
    };

    const limit = normalizePaginationLimit(query.get("limit"));

    const filters: ArregloListFilters = {
        tallerId: toUndef(query.get("taller_id")),
        search: toUndef(query.get("search")),
        patente: toUndef(query.get("patente")),
        tipo: toUndef(query.get("tipo")),
        estado: toUndef(query.get("estado")),
        fechaDesde: toUndef(query.get("fecha_desde")),
        fechaHasta: toUndef(query.get("fecha_hasta")),
        limit,
    };

    const { data, error } = await arregloService.getArreglo(supabase, filters)
    if (error) {
        const status = error === ServiceError.NotFound ? 404 : 500;
        const message = status === 404 ? "Arreglos no encontrados" : "Error cargando arreglos";
        return Response.json({
            data: [],
            page: { hasMore: false },
            error: message
        }, { status })
    }

    logger.debug("GET /api/arreglos - data:", data, "error:", error);

    const arreglos: Arreglo[] = (data?.items ?? [])
    return Response.json({
        data: arreglos,
        page: {
            hasMore: data?.hasMore ?? false,
        },
    })
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
        estado,
        kilometraje_leido,
        fecha,
        observaciones,
        precio_final,
        esta_pago,
        extra_data,
        detalles,
        repuestos,
        repuestos_nuevos,
        detalle_formulario,
    } = body as CreateArregloRequest

    if (!vehiculo_id) return Response.json({ error: "Falta vehiculo_id" }, { status: 400 });
    if (!taller_id) return Response.json({ error: "Falta taller_id" }, { status: 400 });
    if (!fecha) return Response.json({ error: "Falta fecha" }, { status: 400 });

    const precioFinalNumber = Number(precio_final) || 0;
    const kmNumber = Number(kilometraje_leido) || 0;
    const tipoValue = String(tipo ?? "").trim();
    const estadoRaw = String(estado ?? "SIN_INICIAR").trim().toUpperCase();

    if (!(ESTADOS_ARREGLO as string[]).includes(estadoRaw)) {
        return Response.json({ error: "Estado de arreglo inválido" }, { status: 400 });
    }

    const estadoValue = estadoRaw as EstadoArreglo;
    const detalleFormularioConfigId = detalle_formulario
        ? String(detalle_formulario.formulario_id ?? detalle_formulario.config_id ?? "").trim()
        : "";
    const detalleFormularioMetadata = Array.isArray(detalle_formulario?.metadata)
        ? detalle_formulario.metadata
        : [];
    const detallesArr = Array.isArray(detalles) ? detalles : [];
    const repuestosArr = Array.isArray(repuestos) ? repuestos : [];
    const repuestosNuevosArr = Array.isArray(repuestos_nuevos) ? repuestos_nuevos : [];
    const normalizedDetalles = detallesArr.map((d) => ({
        descripcion: String((d as { descripcion?: unknown }).descripcion ?? "").trim(),
        cantidad: Number((d as { cantidad?: unknown }).cantidad),
        valor: Number((d as { valor?: unknown }).valor),
    }));

    for (const d of normalizedDetalles) {
        if (!d.descripcion) return Response.json({ error: "Falta descripción en servicios" }, { status: 400 });
        if (!Number.isFinite(d.cantidad) || d.cantidad <= 0) {
            return Response.json({ error: "Cantidad inválida en servicios" }, { status: 400 });
        }
        if (!Number.isFinite(d.valor) || d.valor < 0) {
            return Response.json({ error: "Valor inválido en servicios" }, { status: 400 });
        }
    }

    if (estadoValue === "TERMINADO" && detalleFormularioConfigId) {
        const { data: formularioRow, error: formularioError } = await supabase
            .from("formularios")
            .select("metadata")
            .eq("id", detalleFormularioConfigId)
            .maybeSingle();

        if (formularioError) {
            return Response.json({ error: "Error cargando formulario custom" }, { status: 500 });
        }

        if (!formularioRow) {
            return Response.json({ error: "Formulario custom no encontrado" }, { status: 400 });
        }

        const missingFields = findMissingRequiredCustomFormFields({
            formMetadata: formularioRow.metadata,
            detalleMetadata: detalleFormularioMetadata,
        });

        if (missingFields.length > 0) {
            return Response.json(
                { error: buildTerminadoRequiredFieldsErrorMessage(missingFields) },
                { status: 400 }
            );
        }
    }

    const ivaRate = IVA_RATE
    const computedSinIva = Number((precioFinalNumber / (1 + ivaRate)).toFixed(2));

    const insertPayload: CreateArregloInsertPayload = {
        vehiculo_id,
        taller_id,
        tipo: tipoValue,
        estado: estadoValue,
        descripcion: buildArregloDescripcion({
            tipo: tipoValue,
            detalles: normalizedDetalles,
            detalleFormulario: detalleFormularioMetadata,
        }),
        kilometraje_leido: kmNumber,
        fecha,
        observaciones: observaciones ?? null,
        precio_final: precioFinalNumber,
        precio_sin_iva: computedSinIva,
        esta_pago: typeof esta_pago === 'boolean' ? esta_pago : false,
        extra_data: extra_data ?? null,
    };

    // Opcional: crear líneas (servicios + repuestos) en el mismo POST.
    // Esto se usa principalmente desde el ArregloModal (crear).
    const normalizedRepuestos = repuestosArr.map((r) => ({
        stock_id: String((r as { stock_id?: unknown }).stock_id ?? "").trim(),
        cantidad: Number((r as { cantidad?: unknown }).cantidad),
        monto_unitario: Number((r as { monto_unitario?: unknown }).monto_unitario),
    }));

    const normalizedRepuestosNuevos = repuestosNuevosArr.map((r) => ({
        codigo: String((r as { codigo?: unknown }).codigo ?? "").trim(),
        nombre: String((r as { nombre?: unknown }).nombre ?? "").trim(),
        precio_compra: Number((r as { precio_compra?: unknown }).precio_compra),
        precio_venta: Number((r as { precio_venta?: unknown }).precio_venta),
        cantidad: Number((r as { cantidad?: unknown }).cantidad),
    }));

    for (const r of normalizedRepuestos) {
        if (!r.stock_id) return Response.json({ error: "Falta stock_id en repuestos" }, { status: 400 });
        if (!Number.isFinite(r.cantidad) || r.cantidad <= 0) return Response.json({ error: "Cantidad invalida en repuestos" }, { status: 400 });
        if (!Number.isFinite(r.monto_unitario) || r.monto_unitario < 0) return Response.json({ error: "Monto unitario invalido en repuestos" }, { status: 400 });
    }

    const stockIdSet = new Set<string>();
    for (const r of normalizedRepuestos) {
        if (stockIdSet.has(r.stock_id)) {
            return Response.json({ error: "Repuestos duplicados (stock_id)" }, { status: 400 });
        }
        stockIdSet.add(r.stock_id);
    }

    const codigoSet = new Set<string>();
    for (const r of normalizedRepuestosNuevos) {
        const codigoKey = r.codigo.toLowerCase();
        if (!r.codigo) return Response.json({ error: "Falta codigo en producto nuevo" }, { status: 400 });
        if (!r.nombre) return Response.json({ error: "Falta nombre en producto nuevo" }, { status: 400 });
        if (!Number.isFinite(r.precio_compra) || r.precio_compra < 0) return Response.json({ error: "Precio de compra invalido" }, { status: 400 });
        if (!Number.isFinite(r.precio_venta) || r.precio_venta < 0) return Response.json({ error: "Precio de venta invalido" }, { status: 400 });
        if (!Number.isFinite(r.cantidad) || r.cantidad <= 0) return Response.json({ error: "Cantidad invalida en producto nuevo" }, { status: 400 });
        if (codigoSet.has(codigoKey)) {
            return Response.json({ error: "Ya existe un producto con ese codigo. Seleccionalo desde el listado." }, { status: 409 });
        }
        codigoSet.add(codigoKey);
    }

    if (detalle_formulario) {
        const costo = Number(detalle_formulario.costo);
        if (!Number.isFinite(costo) || costo < 0) {
            return Response.json({ error: "Costo invalido en detalle de formulario" }, { status: 400 });
        }
    }

    const { data: arregloIdRpc, error: rpcError } = await supabase.rpc("rpc_crear_arreglo_completo", {
        p_vehiculo_id: insertPayload.vehiculo_id,
        p_taller_id: insertPayload.taller_id,
        p_tipo: insertPayload.tipo,
        p_estado: insertPayload.estado,
        p_descripcion: insertPayload.descripcion,
        p_kilometraje_leido: insertPayload.kilometraje_leido,
        p_fecha: insertPayload.fecha,
        p_observaciones: insertPayload.observaciones,
        p_precio_final: insertPayload.precio_final,
        p_precio_sin_iva: insertPayload.precio_sin_iva,
        p_esta_pago: insertPayload.esta_pago,
        p_extra_data: insertPayload.extra_data,
        p_detalles: normalizedDetalles,
        p_repuestos: normalizedRepuestos,
        p_repuestos_nuevos: normalizedRepuestosNuevos,
        p_detalle_formulario: detalle_formulario ?? null,
    });

    if (rpcError || !arregloIdRpc) {
        const raw = String(rpcError?.message ?? "");
        const isStock = raw.includes("STOCK_INSUFICIENTE");
        const isDuplicate = raw.includes("PRODUCTO_CODIGO_DUPLICADO") || raw.includes("uq_productos_tenant_codigo");
        const status = isStock ? 409 : isDuplicate ? 409 : 500;
        const message = isStock
            ? "Stock insuficiente"
            : isDuplicate
                ? "Ya existe un producto con ese codigo. Seleccionalo desde el listado."
                : "No se pudieron guardar los repuestos.";
        return Response.json({ error: message }, { status });
    }

    const { data: createdArreglo, error: fetchError } = await supabase
        .from("arreglos")
        .select("*")
        .eq("id", String(arregloIdRpc))
        .single();

    if (fetchError || !createdArreglo) {
        return Response.json({ error: "Arreglo creado, pero no se pudo cargar" }, { status: 500 });
    }

    await statsService.onDataChanged(supabase);
    return Response.json({ data: createdArreglo, error: null }, { status: 201 });

}
