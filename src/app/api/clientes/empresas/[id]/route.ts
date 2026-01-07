import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'
import { Vehiculo } from '@/model/types'
import { empresaService } from '../empresaService'
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";

export type Empresa = {
  id: string;
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

	const { data, error, code } = await empresaService.getByIdWithVehiculos(supabase, id)

	if (error) {
		console.error('Error cargando empresa', error)
		const status = code === 'PGRST116' ? 404 : 500 // Not found vs server error
		return Response.json({ data: null, error: error.message }, { status })
	}

	return Response.json({ data })
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

	const { data, error } = await empresaService.updateById(supabase, id, payload as unknown as Record<string, unknown>)

	if (error) {
		console.error('Error actualizando empresa', error)
		return Response.json({ error: error.message }, { status: 500 })
	}

	await statsService.onDataChanged(supabase)
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

	await statsService.onDataChanged(supabase)
	return Response.json({ data: null })
}