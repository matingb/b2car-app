import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'
import { Vehiculo } from '@/model/types'
import { empresaService } from '../empresaService'

export type Empresa = {
  id: number;
  nombre: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  vehiculos?: Vehiculo[];
};

export type UpdateEmpresaRequest = {
  nombre: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
};

export type UpdateEmpresaResponse = {
  data: Empresa | null;
  error?: string | null;
};

export type GetEmpresaByIdResponse = {
  data: Empresa | null;
  error?: string | null;
};

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
	const payload: UpdateEmpresaRequest | null = await req.json().catch(() => null)

	if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 })
	if (!payload.nombre) return Response.json({ error: "Falta nombre" }, { status: 400 })
	if (!payload.cuit) return Response.json({ error: "Falta CUIT" }, { status: 400 })

	const { data, error } = await supabase
		.from('empresas')
		.update(payload)
		.eq('id', id)
		.select()
		.single()

	if (error) {
		console.error('Error actualizando empresa', error)
		return Response.json({ error: error.message }, { status: 500 })
	}

	return Response.json({ data })
}

// DELETE /api/clientes/empresas/[id]
// Elimina una empresa y su cliente asociado en una transacción atómica
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const supabase = await createClient()
	const { id } = await params

	const { error } = await empresaService.delete(supabase, id)

	if (error) {
		return Response.json({ error: error.message }, { status: 500 })
	}

	return Response.json({ data: null })
}