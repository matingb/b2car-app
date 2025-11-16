import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'

// GET /api/clientes/particulares/[id]
// Devuelve los datos de un particular junto con sus vehículos
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params

	const { data, error } = await supabase
		.from('clientes')
		.select('*, particular:particulares(*), vehiculos(*)')
		.eq('id', id)
		.single()

	if (error) {
		console.error('Error cargando particular', error)
		const status = error.code === 'PGRST116' ? 404 : 500
		return Response.json({ data: null, error: error.message }, { status })
	}

	const particular = {
		id: data.id as number,
		nombre: data.particular?.nombre ?? '',
		apellido: data.particular?.apellido ?? '',
		telefono: data.particular?.telefono ?? '',
		email: data.particular?.email ?? '',
		direccion: data.particular?.direccion ?? '',
		vehiculos: data.vehiculos ?? [],
	}

	return Response.json({ data: particular })
}

// PUT /api/clientes/particulares/[id]
// Actualiza los datos de un particular
export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params
	const body = await req.json().catch(() => null)

	if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 })

	const { nombre, apellido, telefono, email, direccion } = body as {
		nombre: string;
		apellido?: string;
		telefono?: string;
		email?: string;
		direccion?: string;
	}

	if (!nombre) return Response.json({ error: "Falta nombre" }, { status: 400 })

	const { data, error } = await supabase
		.from('particulares')
		.update({ nombre, apellido, telefono, email, direccion })
		.eq('id', id)
		.select()
		.single()

	if (error) {
		console.error('Error actualizando particular', error)
		return Response.json({ error: error.message }, { status: 500 })
	}

	return Response.json({ data })
}

