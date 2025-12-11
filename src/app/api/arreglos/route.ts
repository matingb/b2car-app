import { Arreglo } from "@/model/types"
import { createClient } from "@/supabase/server"

export type GetArreglosResponse = {
    data: Arreglo[] | null;
    error?: string | null;
};

export type CreateArregloResponse = {
    data: Arreglo | null;
    error?: string | null;
};

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('arreglos').select('*, vehiculo:vehiculos(*)')
    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }

    const arreglos: Arreglo[] = data.map(arreglo => ({
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
    } = body as Record<string, any>;

    if (!vehiculo_id) return Response.json({ error: "Falta vehiculo_id" }, { status: 400 });
    if (kilometraje_leido == null) return Response.json({ error: "Falta kilometraje_leido" }, { status: 400 });
    if (!fecha) return Response.json({ error: "Falta fecha" }, { status: 400 });
    if (precio_final == null) return Response.json({ error: "Falta precio_final" }, { status: 400 });

    // Calcular precio_sin_iva a partir de precio_final y la tasa de IVA de env
    const getIvaRate = () => {
        const rateEnv = process.env.IVA_RATE; // e.g., 0.21
        const percentEnv = process.env.IVA_PERCENT; // e.g., 21
        let rate = 0.21;
        if (rateEnv && !Number.isNaN(Number(rateEnv)) && Number(rateEnv) >= 0 && Number(rateEnv) < 1) {
            rate = Number(rateEnv);
        } else if (percentEnv && !Number.isNaN(Number(percentEnv)) && Number(percentEnv) >= 0) {
            rate = Number(percentEnv) / 100;
        }
        return rate;
    };
    const ivaRate = getIvaRate();
    const computedSinIva = Number((Number(precio_final) / (1 + ivaRate)).toFixed(2));

    const insertPayload = {
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
    } as const;

    const { data: insertData, error: insertError } = await supabase.from('arreglos').insert([insertPayload]).select('*, vehiculo:vehiculos(*)').single();
    if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ data: insertData, error: null }, { status: 201 });
}

export async function DELETE(req: Request) {
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

    const { error } = await supabase
        .from('arreglos')
        .delete()
        .eq('id', id);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ error: null }, { status: 200 });
}