import { createClient } from "@/supabase/server"
import { NextRequest } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_: NextRequest, __: RouteContext<'/api/vehiculos'>) {
    const res = await fetch('https://izczuohetsocgrcjupgy.supabase.co/functions/v1/getVehiculos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
    })
    const {data, error} = await res.json()
    console.log(data, error)
    // const supabase = await createClient()
    // const {data, error} = await supabase.from('vehiculos').select('*')
    // console.log(data, error)
    // if (error) {
    //     return Response.json({ data: [], error: error.message }, { status: 500 })
    // }
    return Response.json({ data, error: null })
}