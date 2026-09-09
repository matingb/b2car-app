import { NextRequest } from "next/server";
import { POST as postCobroRoute, DELETE as deleteCobroRoute } from "@/app/api/arreglos/[id]/cobro/route";
import { DELETE as deleteArregloRoute } from "@/app/api/arreglos/[id]/route";
import { POST as postRepuestosRoute } from "@/app/api/arreglos/[id]/repuestos/route";
import { DELETE as deleteRepuestoLineaRoute } from "@/app/api/arreglos/[id]/repuestos/[lineaId]/route";

export interface CobrarArregloPayload {
  cuenta_financiera_id: string;
  monto: number;
  fecha_cobro?: string;
  descripcion?: string;
  idempotency_key?: string;
}

export interface AsignarRepuestoPayload {
  stock_id: string;
  cantidad: number;
  monto_unitario: number;
  tipo?: string;
  taller_id?: string;
  [key: string]: unknown;
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

