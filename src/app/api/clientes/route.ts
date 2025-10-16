import { TipoCliente } from "@/model/types"
import { createClient } from "@/supabase/server"

interface Cliente {
    id: number
    nombre: string
    tipo_cliente: TipoCliente
    telefono: string
    email: string
    direccion: string
}

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await
        supabase
            .from('clientes')
            .select('*, personas(*), empresas(*)')

    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }

const clientes: Cliente[] = data.map(cliente => {
    if (cliente.tipo_cliente === "persona") {
        return {
            id: cliente.id,
            nombre: cliente.personas.nombre,
            tipo_cliente: cliente.tipo_cliente,
            telefono: cliente.personas.telefono,
            email: cliente.personas.email,
            direccion: cliente.personas.direccion
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