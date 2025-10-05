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
    const {cliente, arreglos} = await res.json()
    console.log(cliente, arreglos)
    /*
    if (Array.isArray(cliente)) {
        const item = cliente[0] ?? {}
        const { personas = {}, ...rest } = item
        data[0] = { ...rest, ...personas }
    } else {
        const { personas = {}, ...rest } = data ?? {}
        Object.keys(data).forEach(k => delete (data as any)[k])
        Object.assign(data, { ...rest, ...personas })
    }
    */

    return Response.json({ cliente: cliente[0], arreglos })
}