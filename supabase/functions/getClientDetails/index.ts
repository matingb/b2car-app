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
            select('*, personas(*), vehiculos(*)')
            .eq('cliente_id', body.cliente_id);

        const vehicleIds = (data ?? [])
            .flatMap((cliente: any) => (cliente.vehiculos ?? []).map((v: any) => v.vehiculo_id))
            .filter(Boolean);
        const uniqueIds = [...new Set(vehicleIds)];

        let arreglos: any[] = [];
        if (uniqueIds.length > 0) {
            const { data: arreglosData, error: arreglosError } = await supabase
                .from('arreglos')
                .select('*')
                .in('vehiculo_id', uniqueIds)
                .order('fecha', { ascending: false })
                .limit(15);

            if (arreglosError) {
                throw arreglosError;
            }
            arreglos = arreglosData ?? [];
        }

        if (error) {
            throw error;
        }
        return new Response(JSON.stringify({
            cliente: data,
            arreglos,
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
