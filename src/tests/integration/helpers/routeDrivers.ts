import { NextRequest } from "next/server";
import { POST as postCobroRoute, DELETE as deleteCobroRoute } from "@/app/api/arreglos/[id]/cobro/route";
import { DELETE as deleteArregloRoute } from "@/app/api/arreglos/[id]/route";
import { POST as postRepuestosRoute, type UpsertRepuestoRequest } from "@/app/api/arreglos/[id]/repuestos/route";
import { DELETE as deleteRepuestoLineaRoute } from "@/app/api/arreglos/[id]/repuestos/[lineaId]/route";
import { POST as postEmpleadoRoute } from "@/app/api/empleados/route";
import type { CreateEmpleadoRequest } from "@/app/api/empleados/contracts";
import { POST as postOperacionesRoute, type CreateOperacionRequest } from "@/app/api/operaciones/route";
import { POST as postOperacionPagoRoute } from "@/app/api/operaciones/[id]/pagos/route";
import { POST as postOperacionConfirmarStockRoute } from "@/app/api/operaciones/[id]/confirmar-stock/route";
import { GET as getProveedorOperacionesRoute } from "@/app/api/proveedores/[id]/operaciones/route";
import { POST as postProveedorRoute, type CreateProveedorRequest } from "@/app/api/proveedores/route";
import { GET as getClienteCuentaCorrienteRoute } from "@/app/api/clientes/[id]/cuenta-corriente/route";
import { GET as getClienteResumenFinancieroRoute } from "@/app/api/clientes/[id]/resumen-financiero/route";

export interface CobrarArregloPayload {
  cuenta_financiera_id: string;
  monto: number;
  fecha_cobro?: string;
  descripcion?: string;
  idempotency_key?: string;
}

export type AsignarRepuestoPayload = UpsertRepuestoRequest;

export interface RegistrarPagoOperacionPayload {
  cuenta_id: string;
  monto: number;
  fecha?: string;
  descripcion?: string;
  idempotency_key?: string;
}

/**
 * Driver: Invoca la API route POST /api/arreglos/[id]/cobro encapsulando la creación de NextRequest.
 */
export async function cobrarArregloViaRoute(
  arregloId: string,
  payload: CobrarArregloPayload
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/arreglos/${arregloId}/cobro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fecha_cobro: new Date().toISOString().slice(0, 10),
      descripcion: "Cobro registrado",
      ...payload,
    }),
  });

  return postCobroRoute(req, {
    params: Promise.resolve({ id: arregloId }),
  });
}

/**
 * Driver: Invoca la API route DELETE /api/arreglos/[id]/cobro?operacion_id=...
 */
export async function anularCobroArregloViaRoute(
  arregloId: string,
  operacionId: string
): Promise<Response> {
  const req = new NextRequest(
    `http://localhost:3000/api/arreglos/${arregloId}/cobro?operacion_id=${operacionId}`,
    { method: "DELETE" }
  );

  return deleteCobroRoute(req, {
    params: Promise.resolve({ id: arregloId }),
  });
}

/**
 * Driver: Invoca la API route POST /api/arreglos/[id]/repuestos encapsulando el request.
 */
export async function asignarRepuestoViaRoute(
  arregloId: string,
  payload: AsignarRepuestoPayload
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/arreglos/${arregloId}/repuestos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: "existente",
      ...payload,
    }),
  });

  return postRepuestosRoute(req, {
    params: Promise.resolve({ id: arregloId }),
  });
}

/**
 * Driver: Invoca la API route DELETE /api/arreglos/[id]/repuestos/[lineaId] encapsulando el request.
 */
export async function eliminarRepuestoLineaViaRoute(
  arregloId: string,
  lineaId: string
): Promise<Response> {
  const req = new NextRequest(
    `http://localhost:3000/api/arreglos/${arregloId}/repuestos/${lineaId}`,
    { method: "DELETE" }
  );

  return deleteRepuestoLineaRoute(req, {
    params: Promise.resolve({ id: arregloId, lineaId }),
  });
}

/**
 * Driver: Invoca la API route DELETE /api/arreglos/[id] encapsulando el request.
 */
export async function borrarArregloViaRoute(arregloId: string): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/arreglos/${arregloId}`, {
    method: "DELETE",
  });

  return deleteArregloRoute(req, {
    params: Promise.resolve({ id: arregloId }),
  });
}

/**
 * Driver: Invoca la API route POST /api/empleados encapsulando el request.
 */
export async function crearEmpleadoViaRoute(
  payload: Partial<CreateEmpleadoRequest>
): Promise<Response> {
  const req = new NextRequest("http://localhost:3000/api/empleados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return postEmpleadoRoute(req);
}

/**
 * Driver: Invoca la API route POST /api/operaciones encapsulando el request.
 */
export async function crearOperacionViaRoute(
  payload: Partial<CreateOperacionRequest>
): Promise<Response> {
  const req = new NextRequest("http://localhost:3000/api/operaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      ...payload,
    }),
  });

  return postOperacionesRoute(req);
}

/**
 * Driver: Invoca la API route POST /api/operaciones/[id]/pagos encapsulando el request.
 */
export async function registrarPagoOperacionViaRoute(
  operacionId: string,
  payload: RegistrarPagoOperacionPayload
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/operaciones/${operacionId}/pagos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      ...payload,
    }),
  });

  return postOperacionPagoRoute(req, {
    params: Promise.resolve({ id: operacionId }),
  });
}

/**
 * Driver: Invoca la API route POST /api/operaciones/[id]/confirmar-stock encapsulando el request.
 */
export async function confirmarStockOperacionViaRoute(
  operacionId: string,
  payload?: { fecha?: string; lineas?: { lineaId?: string; stockId?: string; cantidad: number }[] }
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/operaciones/${operacionId}/confirmar-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });

  return postOperacionConfirmarStockRoute(req, {
    params: Promise.resolve({ id: operacionId }),
  });
}


/**
 * Driver: Invoca la API route GET /api/proveedores/[id]/operaciones encapsulando el request.
 */
export async function getProveedorOperacionesViaRoute(
  proveedorId: string
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/proveedores/${proveedorId}/operaciones`, {
    method: "GET",
  });

  return getProveedorOperacionesRoute(req, {
    params: Promise.resolve({ id: proveedorId }),
  });
}

/**
 * Driver: Invoca la API route POST /api/proveedores encapsulando el request.
 */
export async function crearProveedorViaRoute(
  payload: Partial<CreateProveedorRequest>
): Promise<Response> {
  const req = new NextRequest("http://localhost:3000/api/proveedores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return postProveedorRoute(req, { params: Promise.resolve({}) });
}

/**
 * Driver: Invoca la API route GET /api/clientes/[id]/cuenta-corriente encapsulando el request.
 */
export async function getClienteCuentaCorrienteViaRoute(
  clienteId: string,
  filters?: { from?: string; to?: string }
): Promise<Response> {
  const query = new URLSearchParams();
  if (filters?.from) query.set("from", filters.from);
  if (filters?.to) query.set("to", filters.to);
  const qStr = query.toString() ? `?${query.toString()}` : "";
  const req = new NextRequest(`http://localhost:3000/api/clientes/${clienteId}/cuenta-corriente${qStr}`, {
    method: "GET",
  });

  return getClienteCuentaCorrienteRoute(req, {
    params: Promise.resolve({ id: clienteId }),
  });
}

/**
 * Driver: Invoca la API route GET /api/clientes/[id]/resumen-financiero encapsulando el request.
 */
export async function getClienteResumenFinancieroViaRoute(
  clienteId: string
): Promise<Response> {
  const req = new NextRequest(`http://localhost:3000/api/clientes/${clienteId}/resumen-financiero`, {
    method: "GET",
  });

  return getClienteResumenFinancieroRoute(req, {
    params: Promise.resolve({ id: clienteId }),
  });
}

