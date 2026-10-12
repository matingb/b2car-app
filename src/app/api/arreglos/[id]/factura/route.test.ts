import { describe, expect, it, vi } from "vitest";

const { issue, actor } = vi.hoisted(() => ({ issue: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/facturacion/facturacionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facturacion/facturacionService")>();
  return { ...actual, issueFacturaElectronica: issue };
});
vi.mock("@/lib/facturacion/serverAuth", () => ({ requireTenantBillingActor: actor, facturacionErrorResponse: vi.fn() }));
vi.mock("@/lib/facturacion/environment", () => ({ getFacturacionAmbiente: () => "HOMOLOGACION" }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "./route";
import { FceDataRequiredError } from "@/lib/facturacion/facturacionService";

describe("POST factura de arreglo: recuperación FCE", () => {
  it("serializa FCE_DATA_REQUIRED y sus metadatos", async () => {
    actor.mockResolvedValue({ tenantId: "tenant" });
    issue.mockRejectedValue(new FceDataRequiredError({ cbuConfigurado: true, sistema: null }));
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", receptor: { tipoDocumento: 99, condicionIvaReceptorId: 5 }, fechas: { fechaComprobante: "2026-10-08" } }) }), { params: Promise.resolve({ id: "arreglo" }) });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "FCE_DATA_REQUIRED", fce: { cbuConfigurado: true, sistema: null } });
  });
});
