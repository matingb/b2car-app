import { Vehiculo } from "@/model/types"
import { createClient } from "@/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('vista_vehiculos_con_clientes').select('*');
    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }


    const vehiculos: Vehiculo[] = data.map(v => ({
      id: v.id,
      nombre_cliente: v.nombre_cliente,
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      fecha_patente: v.fecha_patente
    }));
    return Response.json({ data: vehiculos, error: null })
}

