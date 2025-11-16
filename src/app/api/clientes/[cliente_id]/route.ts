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
    if (error) {
        console.error("Error cargando cliente", error);
        const status = (error as any)?.code === 'PGRST116' ? 404 : 500
        return Response.json({ data: null, arreglos: [] }, { status })
    }

    const particular: Particular = {
        id: data.id,
        nombre: data.particular?.nombre || "",
        apellido: data.particular?.apellido || "",
        telefono: data.particular?.telefono || "",
        email: data.particular?.email || "",
        direccion: data.particular?.direccion || "",
        vehiculos: data.vehiculos || []
    };

    return Response.json({ data: particular })
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ cliente_id: string }> }
) {
    const supabase = await createClient()
    const { cliente_id } = await params

    const { data, error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente_id)
        .select('id')

    if (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
        return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return Response.json({ error: null }, { status: 200 })
}