import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'

interface Particular {
    id: number
    nombre: string
    telefono: string
    email: string
    direccion: string
}

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

    const particular: Particular = data?.particular;       

    if (error) {
        console.error("Error cargando cliente", error);
        return Response.json({ data: null, arreglos: [] }, { status: 500 })
    }

    return Response.json({ data: particular })
}