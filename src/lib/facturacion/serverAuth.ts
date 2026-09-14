import "server-only";

import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import { Feature, hasFeature, type FeatureValue } from "@/lib/subscription";
import { FacturacionValidationError } from "./arcaPayload";
import { FceMipymeQueryError } from "./fceMipyme";

export class FacturacionHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
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
  claimedPlan: unknown;
};

export const FEATURE_NOT_AVAILABLE_FOR_PLAN = "FEATURE_NOT_AVAILABLE_FOR_PLAN";

const CUIT_CERTIFICATE_RELATION_MESSAGE = "El CUIT ingresado no está asociado al certificado configurado";

function isCuitCertificateRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /ValidacionDeToken/i.test(message)
    && /CUIT\s+en\s+lista\s+de\s+relaciones/i.test(message);
}

export async function requireTenantActor(): Promise<TenantActor> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id : "";
  const claimedRole = typeof claims?.user_role === "string" ? claims.user_role : "";
  const claimedPlan = claims?.plan_sub;
  if (claimsError || !userId) {
    throw new FacturacionHttpError("Sesión requerida", 401);
  }
  if (!tenantId) {
    throw new FacturacionHttpError("La sesión no tiene un tenant activo", 403);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, rol")
    .eq("cliente_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (membershipError) {
    logger.error(
      "Error al validar membresía de tenant para facturación:",
      membershipError,
    );
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
    claimedPlan,
  };
}

export async function requireTenantFeature(feature: FeatureValue): Promise<TenantActor> {
  const actor = await requireTenantActor();
  if (!hasFeature(actor.claimedPlan, feature)) {
    throw new FacturacionHttpError(
      "La funcionalidad no está disponible en el plan actual",
      403,
      FEATURE_NOT_AVAILABLE_FOR_PLAN,
    );
  }
  return actor;
}

export async function requireTenantFeatureAdmin(feature: FeatureValue): Promise<TenantActor> {
  const actor = await requireTenantFeature(feature);
  if (actor.role !== "admin" || actor.claimedRole !== "admin") {
    throw new FacturacionHttpError("Esta acción requiere un administrador del tenant", 403);
  }
  return actor;
}

export async function requireTenantBillingActor(): Promise<TenantActor> {
  return requireTenantFeature(Feature.Billing);
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
    return Response.json({ error: error.code ?? error.message }, { status: error.status });
  }
  if (error instanceof FacturacionValidationError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof FceMipymeQueryError) {
    return Response.json({ error: error.message, code: error.code }, { status: 503 });
  }
  if (isCuitCertificateRelationError(error)) {
    return Response.json({ error: CUIT_CERTIFICATE_RELATION_MESSAGE }, { status: 422 });
  }
  logger.error("Error de facturación electrónica", error);
  return Response.json({ error: "No se pudo completar la operación de facturación" }, { status: 500 });
}
