import { createClient } from "@/supabase/server"
import {logger} from "@/lib/logger"
import { clienteService } from "./clienteService"

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await clienteService.listAll(supabase)

    logger.debug("Clientes obtenidos:", JSON.stringify(data, null, 2));

    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }
    return Response.json({ data, error: null })
}