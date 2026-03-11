import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { formularioService, type FormularioConfigItem } from "./formularioService";

export type GetFormularioConfigResponse = {
	data: FormularioConfigItem[] | null;
	error?: string | null;
};

// GET /api/arreglos/formularios -> listar configuración dinámica del formulario por tenant
export async function GET() {
	const supabase = await createClient();
	const { data: authData } = await supabase.auth.getSession();

	if (!authData.session) {
		return Response.json(
			{ data: null, error: "Unauthorized" } satisfies GetFormularioConfigResponse,
			{ status: 401 }
		);
	}

	const { data, error } = await formularioService.listAll(supabase);
	if (error) {
		logger.error("GET /api/arreglos/formularios - error:", error);
		return Response.json(
			{ data: [], error: "Error cargando configuración de formulario" } satisfies GetFormularioConfigResponse,
			{ status: 500 }
		);
	}

	return Response.json(
		{ data, error: null } satisfies GetFormularioConfigResponse,
		{ status: 200 }
	);
}
