import "server-only";

import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import { FacturacionValidationError } from "./arcaPayload";

export class FacturacionHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FacturacionHttpError";
  }
}

export type TenantActor = {
  userId: string;
  tenantId: string;
  role: string;
  claimedRole: string;
};

export async function requireTenantActor(): Promise<TenantActor> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id : "";
  const claimedRole = typeof claims?.user_role === "string" ? claims.user_role : "";
  if (claimsError || !userId) {
    throw new FacturacionHttpError("Sesión requerida", 401);
  }
  if (!tenantId) {
    throw new FacturacionHttpError("La sesión no tiene un tenant activo", 403);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    throw new FacturacionHttpError(
      "La facturación electrónica no tiene configurado el acceso interno a Supabase",
      500,
    );
  }
  const { data: membership, error: membershipError } = await admin
    .from("tenant_members")
    .select("tenant_id, rol")
    .eq("cliente_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (membershipError) {
    throw new FacturacionHttpError(
      "No se pudo validar la membresía por un error de configuración interna",
      500,
    );
  }
  if (!membership?.tenant_id) {
    throw new FacturacionHttpError("No se encontró una membresía de tenant activa", 403);
  }
  return {
    userId,
    tenantId: String(membership.tenant_id),
    role: String(membership.rol ?? ""),
    claimedRole,
  };
}

export async function requireTenantAdmin(): Promise<TenantActor> {
  const actor = await requireTenantActor();
  if (actor.role !== "admin" || actor.claimedRole !== "admin") {
    throw new FacturacionHttpError("Esta acción requiere un administrador del tenant", 403);
  }
  return actor;
}

export function facturacionErrorResponse(error: unknown): Response {
  if (error instanceof FacturacionHttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof FacturacionValidationError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  console.error("Error de facturación electrónica", error);
  return Response.json({ error: "No se pudo completar la operación de facturación" }, { status: 500 });
}
