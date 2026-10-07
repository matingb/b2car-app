import "server-only";
import tracer from "dd-trace";

/**
 * Asocia el tenant_id como usuario de la traza de Datadog APM
 * y añade los tags tenant_id, tenant_name y plan_sub para permitir filtrado en Datadog.
 */
export function tagDatadogTenant(
  tenantId?: string | null,
  tenantName?: string | null,
  plan?: string | null,
): void {
  if (!tenantId) return;

  try {
    tracer.setUser({
      id: tenantId,
      name: tenantName || undefined,
      plan_sub: plan || undefined,
    });

    const span = tracer.scope().active();
    if (span) {
      span.setTag("tenant_id", tenantId);
      if (tenantName) span.setTag("tenant_name", tenantName);
      if (plan) span.setTag("plan_sub", plan);
    }
  } catch {
    // Silencioso si dd-trace no está activo o no hay traza activa
  }
}
