import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clientes'>) {


    const res = await fetch('https://izczuohetsocgrcjupgy.supabase.co/functions/v1/swift-action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
    })
    const {data} = await res.json()

    return Response.json({ data })
}