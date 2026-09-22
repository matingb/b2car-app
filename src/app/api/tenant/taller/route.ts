
import { createClient } from "@/supabase/server"
import { tallerService } from "../tallerService";

export async function GET() {

    const supabase = await createClient();
    const { data, error } = await tallerService.getTalleres(supabase);

    if (error) {
        return new Response(JSON.stringify({ data: null, error }), { status: 500 });
    }

    return new Response(JSON.stringify({ data, error: null }), {
        status: 200,
    });

}