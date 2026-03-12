import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import { formularioService, type FormularioTemplateItem } from "./formularioService";

export type GetFormulariosResponse = {
	data: FormularioTemplateItem[] | null;
	error?: string | null;
};

// GET /api/arreglos/formularios -> listar formularios template por tenant
export async function GET() {
	const supabase = await createClient();
	const { data: authData } = await supabase.auth.getSession();

	if (!authData.session) {
		return Response.json(
			{ data: null, error: "Unauthorized" } satisfies GetFormulariosResponse,
			{ status: 401 }
		);
	}

	const { data, error } = await formularioService.listAll(supabase);
	if (error) {
		logger.error("GET /api/arreglos/formularios - error:", error);
		return Response.json(
			{ data: [], error: "Error cargando formularios" } satisfies GetFormulariosResponse,
			{ status: 500 }
		);
	}

	return Response.json(
		{ data, error: null } satisfies GetFormulariosResponse,
		{ status: 200 }
	);
}
