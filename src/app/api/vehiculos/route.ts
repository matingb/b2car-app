import { createClient } from "@/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const {data, error} = await supabase.from('vehiculos').select('*')
    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }
    return Response.json({ data, error: null })
}