

// returs a list of talleres
import { Taller } from "@/model/types";
import { createClient } from "@/supabase/server"
import { tenantService } from "../tenantService";

export async function GET() {
    
    const supabase = await createClient();
    const { data, error } = await tenantService.getTalleres(supabase);
    
    if (error) {
        return new Response(JSON.stringify({ data: null, error }), { status: 500 });
    }

    return new Response(JSON.stringify({ data, error: null }), {
        status: 200,
        headers: {
            "Cache-Control": "public, max-age=14400",
        },
    });

}