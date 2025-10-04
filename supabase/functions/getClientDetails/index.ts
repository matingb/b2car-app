// supabase/functions/clientes-list/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

serve(async (req) => {
    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization')
                }
            }
        });

        const body = await req.json();

        const { data, error } = await supabase
            .from('clientes').
            select('*, personas(*)')
            .eq('cliente_id', body.cliente_id);

        if (error) {
            throw error;
        }
        return new Response(JSON.stringify({
            cliente: data,
            isError: false
        }), {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (err) {
        return new Response(String(err?.message ?? err), {
            status: 500
        });
    }
});
