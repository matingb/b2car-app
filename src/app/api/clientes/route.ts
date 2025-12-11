import { Cliente, TipoCliente } from "@/model/types"
import { createClient } from "@/supabase/server"
import {logger} from "@/lib/logger"

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await
        supabase
            .from('clientes')
            .select('*, particular:particulares(*), empresa:empresas(*)')

    logger.debug("Clientes obtenidos:", JSON.stringify(data, null, 2));

    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }

const clientes: Cliente[] = data.map(cliente => {
    if (cliente.tipo_cliente === TipoCliente.PARTICULAR) {
        const nombre = `${cliente.particular?.nombre || ""} ${cliente.particular?.apellido || ""}`.trim();
        return {
            id: cliente.id,
            nombre: nombre,
            tipo_cliente: cliente.tipo_cliente,
            telefono: cliente.particular?.telefono,
            email: cliente.particular?.email,
            direccion: cliente.particular?.direccion
        }
    } else {
        return {
            id: cliente.id,
            nombre: cliente.empresa?.nombre,
            tipo_cliente: cliente.tipo_cliente,
            telefono: cliente.empresa?.telefono,
            email: cliente.empresa?.email,
            direccion: cliente.empresa?.direccion,
            cuit: cliente.empresa?.cuit
        }
    }
})

    return Response.json({ data: clientes, error: null })
}