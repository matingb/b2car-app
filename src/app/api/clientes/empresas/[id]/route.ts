import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'

// GET /api/clientes/empresas/[id]
// Devuelve los datos de una empresa junto con sus vehículos
export async function GET(
	_req: NextRequest,
	{ params }: { params: { id: string } }
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