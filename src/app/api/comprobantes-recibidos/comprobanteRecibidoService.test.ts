import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { ServiceError } from "@/app/api/serviceError";
import {
  supabaseComprobanteRecibidoRepository,
  type ComprobanteRecibidoRow,
} from "./comprobanteRecibidoRepository";
import { createComprobanteRecibidoService } from "./comprobanteRecibidoService";

const factura: ComprobanteRecibidoRow = {
  id: "factura",
  tenant_id: "tenant",
  operacion_id: "compra",
  tipo_documento: "FACTURA",
  clase: "A",
  numero: "0001-00000001",
  fecha: "2026-11-23",
  proveedor_id: "proveedor",
  emisor_razon_social: "Proveedor",
  emisor_cuit: null,
  emisor_condicion_iva: null,
  emisor_domicilio: null,
  receptor_razon_social: null,
  receptor_cuit: null,
  receptor_condicion_iva: null,
  codigo_autorizacion: null,
  vencimiento_autorizacion: null,
  fecha_vencimiento: "2026-12-01",
  observaciones: null,
  desglose_iva: null,
  iva_contenido: null,
  created_at: "",
  updated_at: "",
  operaciones: { tipo: "COMPRA", taller_id: "taller-compra" },
};

const supabase = {} as SupabaseClient;

function mockService(data: ComprobanteRecibidoRow) {
  const getById = vi.fn().mockResolvedValue({ data, error: null });
  const guardarTurnoVencimiento = vi.fn().mockResolvedValue({ error: null });
  const service = createComprobanteRecibidoService({
    ...supabaseComprobanteRecibidoRepository,
    getById,
    guardarTurnoVencimiento,
  });
  return { service, getById, guardarTurnoVencimiento };
}

it("agenda el vencimiento guardado en el taller de la compra sin cliente ni vehículo", async () => {
  const { service, getById, guardarTurnoVencimiento } = mockService(factura);

  await expect(service.crearTurnoVencimiento(supabase, "tenant", "factura")).resolves.toEqual({ data: true, error: null });
  expect(getById).toHaveBeenCalledWith(supabase, "tenant", "factura");
  expect(guardarTurnoVencimiento).toHaveBeenCalledWith(supabase, "tenant", "factura", expect.objectContaining({
    fecha: "2026-12-01",
    taller_id: "taller-compra",
    cliente_id: null,
    vehiculo_id: null,
    tipo: "Vencimiento de factura",
    titulo: "Vencimiento · Factura A 0001-00000001",
    descripcion: expect.stringContaining("Proveedor"),
  }));
});

it.each([
  { fecha_vencimiento: null },
  { tipo_documento: "RETENCION" },
  { operaciones: { tipo: "GASTO", taller_id: "taller-compra" } },
])("rechaza el recordatorio de un documento que no es una factura de compra con vencimiento", async (cambios) => {
  const { service, guardarTurnoVencimiento } = mockService({ ...factura, ...cambios });

  await expect(service.crearTurnoVencimiento(supabase, "tenant", "factura")).resolves.toMatchObject({
    data: null, error: ServiceError.Validation,
  });
  expect(guardarTurnoVencimiento).not.toHaveBeenCalled();
});
