import { Vehiculo } from "@/model/types"
import { createClient } from "@/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('vista_vehiculos_con_clientes').select('*');
    if (error) {
        return Response.json({ data: [], error: error.message }, { status: 500 })
    }


    const vehiculos: Vehiculo[] = data.map(v => ({
      id: v.id,
      nombre_cliente: v.nombre_cliente,
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      fecha_patente: v.fecha_patente
    }));
    return Response.json({ data: vehiculos, error: null })
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 });

  const { cliente_id, patente, marca, modelo, fecha_patente } = body as {
    cliente_id: number | string;
    patente: string;
    marca?: string;
    modelo?: string;
    fecha_patente?: string; // YYYY
  };

  if (!cliente_id) return Response.json({ error: "Falta cliente_id" }, { status: 400 });
  if (!patente) return Response.json({ error: "Falta patente" }, { status: 400 });
  if (!fecha_patente) return Response.json({ error: "Falta año patente" }, { status: 400 });
  if (!marca) return Response.json({ error: "Falta marca" }, { status: 400 });
  if (!modelo) return Response.json({ error: "Falta modelo" }, { status: 400 });
  

  const insertPayload = {
    cliente_id: cliente_id,
    patente,
    marca: marca ?? null,
    modelo: modelo ?? null,
    fecha_patente: fecha_patente ?? null,
  } as const;

  const { data: inserted, error: insertError } = await supabase
    .from('vehiculos')
    .insert([insertPayload])
    .select('id')
    .single();

  if (insertError) {
    const code = (insertError as any)?.code || '';
    const status = code === '23505' ? 409 : 500; // 23505: unique_violation
    return Response.json({ error: insertError?.message || 'No se pudo crear el vehículo' }, { status });
  }

  return Response.json({ data: inserted, error: null }, { status: 201 });
}

