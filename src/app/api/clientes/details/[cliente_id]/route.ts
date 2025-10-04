import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clientes/details/[cliente_id]'>) {

    const { cliente_id } = await ctx.params
    const res = await fetch('https://izczuohetsocgrcjupgy.supabase.co/functions/v1/getClientDetails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify({ cliente_id }),
    })
    const {data} = await res.json()

    return Response.json({ cliente: data[0] })
}