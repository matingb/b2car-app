import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'

// GET /api/clientes/empresas/[id]
// Devuelve los datos de una empresa junto con sus vehículos
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params

	const { data, error } = await supabase
		.from('clientes')
		.select('*, empresa:empresas(*), vehiculos(*)')
		.eq('id', id)
		.single()

	if (error) {
		console.error('Error cargando empresa', error)
		const status = error.code === 'PGRST116' ? 404 : 500 // Not found vs server error
		return Response.json({ data: null, error: error.message }, { status })
	}

	const empresa = {
		id: data.id as number,
		nombre: data.empresa?.nombre ?? '',
		telefono: data.empresa?.telefono ?? '',
        cuit: data.empresa?.cuit ?? '',
		email: data.empresa?.email ?? '',
		direccion: data.empresa?.direccion ?? '',
		vehiculos: data.vehiculos ?? [],
	}

	return Response.json({ data: empresa })
}

// PUT /api/clientes/empresas/[id]
// Actualiza los datos de una empresa
export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params
	const body = await req.json().catch(() => null)

	if (!body) return Response.json({ error: "JSON inválido" }, { status: 400 })

	const { nombre, cuit, telefono, email, direccion } = body as {
		nombre: string;
		cuit: string;
		telefono?: string;
		email?: string;
		direccion?: string;
	}

	if (!nombre) return Response.json({ error: "Falta nombre" }, { status: 400 })
	if (!cuit) return Response.json({ error: "Falta CUIT" }, { status: 400 })

	const { data, error } = await supabase
		.from('empresas')
		.update({ nombre, cuit, telefono, email, direccion })
		.eq('id', id)
		.select()
		.single()

	if (error) {
		console.error('Error actualizando empresa', error)
		return Response.json({ error: error.message }, { status: 500 })
	}

	return Response.json({ data })
}