import { Arreglo } from "@/model/types"
import { createClient } from "@/supabase/server"

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