import { createClient } from '@/supabase/server'
import type { NextRequest } from 'next/server'
import { Particular, TipoCliente } from '@/model/types'
import { particularService } from '../particularService'
import { statsService } from "@/app/api/dashboard/stats/dashboardStatsService";
import { isValidDniCuil, normalizeDniCuil } from "@/lib/documentos";
import { logger } from "@/lib/logger";

export type UpdateParticularRequest = {
  nombre: string;
  apellido?: string;
  codigo_pais?: string;
  telefono: string;
  email: string;
  direccion: string;
  dni_cuil?: string | null;
};

export type UpdateParticularResponse = {
  data: Particular | null;
  error?: string | null;
};

export type GetParticularByIdResponse = {
  data: (Particular & { tipo_cliente: TipoCliente.PARTICULAR }) | null;
  error?: string | null;
};

// GET /api/clientes/particulares/[id]
// Devuelve los datos de un particular junto con sus vehículos
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params

	const { data, error, code } = await particularService.getByIdWithVehiculos(supabase, id)

	if (error) {
		logger.error("Error cargando particular", error)
		const status = code === 'PGRST116' ? 404 : 500
		return Response.json({ data: null, error: error.message }, { status })
	}

	return Response.json({ data })
}

// PUT /api/clientes/particulares/[id]
// Actualiza los datos de un particular
export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const supabase = await createClient()
	const { id } = await params
	const payload: UpdateParticularRequest | null = await req.json().catch(() => null)

	if (!payload) return Response.json({ error: "JSON inválido" }, { status: 400 })
	if (!payload.nombre) return Response.json({ error: "Falta nombre" }, { status: 400 })
	const dniCuil = normalizeDniCuil(payload.dni_cuil)
	if (dniCuil && !isValidDniCuil(dniCuil)) {
		return Response.json({ error: "El DNI/CUIL debe tener 7 u 8 dígitos para DNI, u 11 para CUIL" }, { status: 400 })
	}

	const { data, error } = await particularService.updateById(supabase, id, {
		...payload,
		...(payload.dni_cuil !== undefined ? { dni_cuil: dniCuil } : {}),
	} as Record<string, unknown>)

	if (error) {
		if (error.code === "23505") {
			return Response.json({ error: "Ya existe un particular con ese DNI/CUIL" }, { status: 409 })
		}
		logger.error("Error actualizando particular", error)
		return Response.json({ error: error.message }, { status: 500 })
	}

	await statsService.onDataChanged(supabase)
	return Response.json({ data })
}

// DELETE /api/clientes/particulares/[id]
// Elimina un particular y su cliente asociado en una transacción atómica
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const supabase = await createClient()
	const { id } = await params

	const { error } = await particularService.delete(supabase, id)

	if (error) {
		return Response.json({ error: error.message }, { status: 500 })
	}

	await statsService.onDataChanged(supabase)
	return Response.json({ data: null })
}
