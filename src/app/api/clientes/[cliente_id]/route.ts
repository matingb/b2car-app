import { Particular } from '@/model/types'
import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ cliente_id: string }> }
) {
    const supabase = await createClient()
    const { cliente_id } = await params;
    
    const { data, error } = await
        supabase
            .from('clientes')
            .select('*, particular:particulares(*), vehiculos(*)')
            .eq('id', cliente_id)
            .single()
    const nombre = `${data.particular?.nombre || ""} ${data.particular?.apellido || ""}`.trim();
    const particular: Particular = {
        id: data.id,
        nombre: nombre,
        telefono: data.particular.telefono,
        email: data.particular.email,
        direccion: data.particular.direccion,
        vehiculos: data.vehiculos
    };       

    if (error) {
        console.error("Error cargando cliente", error);
        return Response.json({ data: null, arreglos: [] }, { status: 500 })
    }

    return Response.json({ data: particular })
}