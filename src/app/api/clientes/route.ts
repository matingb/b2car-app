import { Cliente } from "@/model/types"
import { createClient } from "@/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await
        supabase
            .from('clientes')
            .select('*, particular:particulares(*), empresas(*)')

    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }

const clientes: Cliente[] = data.map(cliente => {
    if (cliente.tipo_cliente === "particular") {
        return {
            id: cliente.id,
            nombre: cliente.particular.nombre,
            tipo_cliente: cliente.tipo_cliente,
            telefono: cliente.particular.telefono,
            email: cliente.particular.email,
            direccion: cliente.particular.direccion
        }
    } else {
        return {
            id: cliente.id,
            nombre: cliente.empresas.nombre,
            tipo_cliente: cliente.tipo_cliente,
            telefono: cliente.empresas.telefono,
            email: cliente.empresas.email,
            direccion: cliente.empresas.direccion
        }
    }
})

    return Response.json({ data: clientes, error: null })
}