import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { GET as listRoute, POST as emitirRoute } from "@/app/api/remitos/route";
import { GET as detalleRoute } from "@/app/api/remitos/[id]/route";
import { GET as pdfRoute } from "@/app/api/remitos/[id]/pdf/route";
import { POST as asociarRoute } from "@/app/api/remitos/[id]/factura/route";
import { GET as preflightRoute } from "@/app/api/remitos/preflight/route";
import { GET as getConfigRoute, PUT as putConfigRoute } from "@/app/api/remitos/configuracion/route";
import { GET as facturaRemitosRoute } from "@/app/api/facturas/[id]/remitos/route";
import { GET as documentosRoute } from "@/app/api/documentos/route";
import {
  contarFilas,
  dadaUnaConfiguracionFiscal,
  dadaUnaFacturaAutorizadaConLineas,
  fechaArgentina,
} from "./remitosHelpers";

const BASE = "http://localhost:3000";

function request(path: string, init?: { method: string; body?: unknown }) {
  return new NextRequest(`${BASE}${path}`, init ? {
    method: init.method,
    headers: { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  } : undefined);
}

function segment(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

/** Claves de importe que nunca deben aparecer en respuestas de remitos. */
function amountKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(amountKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(/^(importe|subtotal|iva|precio)|^total$/i.test(key) ? [key] : []),
    ...amountKeys(item),
  ]);
}

const configuracion = {
  remitoR: {
    cai: "71234567890123",
    caiVencimiento: fechaArgentina(30),
    puntoEmision: 2,
    numeroDesde: 1,
    numeroHasta: 50,
    proximoNumero: 1,
    inicioActividades: null,
    autoimpresor: false,
    imprenta: { razonSocial: "Imprenta Sur SA", cuit: "30712345671", fechaImpresion: "2026-01-15", habilitacion: "1234" },
  },
  remitoX: { puntoEmision: 1, proximoNumero: 1 },
};

describe("Integration: API de remitos de punta a punta (B2C-202)", () => {
  it("configura, emite desde factura y sin factura, asocia, lista y genera el PDF sin importes ni ARCA", async () => {
    await dadaUnaConfiguracionFiscal();
    const facturasAntes = await contarFilas("facturas_electronicas");

    // Configuración
    const guardada = await json(await putConfigRoute(request("/api/remitos/configuracion", { method: "PUT", body: configuracion }), segment()));
    expect(guardada.status).toBe(200);
    expect(guardada.body.data).toMatchObject({ ambiente: "HOMOLOGACION", remitoR: { puntoEmision: 2, autoimpresor: true } });
    const leida = await json(await getConfigRoute(request("/api/remitos/configuracion"), segment()));
    expect(leida.body.data.ultimoEmitido).toEqual({ R: null, X: null });

    // Emisión desde factura (facturas creadas después del conteo inicial)
    const { facturaId, lineas: [repuesto, servicio] } = await dadaUnaFacturaAutorizadaConLineas([
      { cantidad: 3, codigo: "FIL", descripcion: "Filtro" },
      { cantidad: 1, descripcion: "Mano de obra", origen: "SERVICIO" },
    ]);
    const facturasConFixture = await contarFilas("facturas_electronicas");
    const preflight = await json(await preflightRoute(request(`/api/remitos/preflight?facturaId=${facturaId}`), segment()));
    expect(preflight.status).toBe(200);
    expect(preflight.body.data).toMatchObject({
      emisor: { completo: true },
      tipos: { R: { emitible: true, proximoNumeroVisible: "R 00002-00000001" }, X: { emitible: true } },
      factura: { label: expect.stringMatching(/^Factura C 00001-\d{8}$/), destinatario: { nombre: "Cliente Factura" } },
    });
    expect(amountKeys(preflight.body)).toEqual([]);

    const remitoR = await json(await emitirRoute(request("/api/remitos", {
      method: "POST",
      body: {
        idempotencyKey: randomUUID(),
        clase: "R",
        facturaId,
        destinatario: preflight.body.data.factura.destinatario,
        transportista: { nombre: "Fletes SA", cuit: "20123456786" },
        lineas: [{ facturaLineaId: repuesto.id, cantidad: 2, observaciones: "Caja 1" }],
      },
    }), segment()));
    expect(remitoR.status).toBe(201);

    // Emisión sin factura y asociación posterior
    const remitoX = await json(await emitirRoute(request("/api/remitos", {
      method: "POST",
      body: {
        idempotencyKey: randomUUID(),
        clase: "X",
        destinatario: { nombre: "Juan Pérez", tipoDocumento: 96, numeroDocumento: "30111222" },
        lineas: [{ codigo: "FIL", descripcion: "Filtro", cantidad: 1 }, { descripcion: "Mano de obra", cantidad: 1 }],
      },
    }), segment()));
    expect(remitoX.status).toBe(201);

    const detalleX = await json(await detalleRoute(request(`/api/remitos/${remitoX.body.data.id}`), segment({ id: remitoX.body.data.id })));
    expect(detalleX.body).toMatchObject({ canManage: true, data: { numeroVisible: "X 00001-00000001", factura: null } });

    const disponibles = await json(await facturaRemitosRoute(request(`/api/facturas/${facturaId}/remitos`), segment({ id: facturaId })));
    expect(disponibles.body.data.lineas.map((linea: { cantidadDisponible: number }) => linea.cantidadDisponible)).toEqual([1, 1]);

    const asociado = await json(await asociarRoute(request(`/api/remitos/${remitoX.body.data.id}/factura`, {
      method: "POST",
      body: {
        facturaId,
        lineas: [
          { remitoLineaId: detalleX.body.data.lineas[0].id, facturaLineaId: repuesto.id },
          { remitoLineaId: detalleX.body.data.lineas[1].id, facturaLineaId: servicio.id },
        ],
      },
    }), segment({ id: remitoX.body.data.id })));
    expect(asociado.status).toBe(200);

    const excedido = await json(await emitirRoute(request("/api/remitos", {
      method: "POST",
      body: { idempotencyKey: randomUUID(), clase: "X", facturaId, destinatario: { nombre: "Juan" }, lineas: [{ facturaLineaId: repuesto.id, cantidad: 1 }] },
    }), segment()));
    expect(excedido).toEqual({
      status: 400,
      body: { error: 'La cantidad a remitir de "Filtro" supera la cantidad facturada disponible (0)', code: "VALIDATION" },
    });

    // Detalle, sección de la factura y listado
    const detalleR = await json(await detalleRoute(request(`/api/remitos/${remitoR.body.data.id}`), segment({ id: remitoR.body.data.id })));
    expect(detalleR.body.data).toMatchObject({
      numeroVisible: "R 00002-00000001",
      cai: "71234567890123",
      transportista: { nombre: "Fletes SA", cuit: "20123456786" },
      factura: { id: facturaId, receptorNombre: "Cliente Factura" },
      lineas: [{ codigo: "FIL", descripcion: "Filtro", observaciones: "Caja 1", cantidad: 2 }],
    });
    expect(amountKeys(detalleR.body)).toEqual([]);

    const remitosFactura = await json(await facturaRemitosRoute(request(`/api/facturas/${facturaId}/remitos`), segment({ id: facturaId })));
    expect(remitosFactura.body.data.remitos.map((remito: { numeroVisible: string }) => remito.numeroVisible).sort())
      .toEqual(["R 00002-00000001", "X 00001-00000001"]);
    expect(remitosFactura.body.data.lineas.map((linea: { cantidadDisponible: number }) => linea.cantidadDisponible)).toEqual([0, 0]);
    expect(amountKeys(remitosFactura.body)).toEqual([]);

    const listado = await json(await listRoute(request("/api/remitos?search=R%2000002-00000001"), segment()));
    expect(listado.body.data.items.map((item: { numeroVisible: string }) => item.numeroVisible)).toEqual(["R 00002-00000001"]);
    const sinFactura = await json(await listRoute(request("/api/remitos?factura=sin"), segment()));
    expect(sinFactura.body.data.total).toBe(0);
    const porDestinatario = await json(await listRoute(request("/api/remitos?search=juan"), segment()));
    expect(porDestinatario.body.data.items.map((item: { clase: string }) => item.clase)).toEqual(["X"]);

    // Documentación: listado unificado de comprobantes fiscales y remitos
    const documentos = await json(await documentosRoute(request("/api/documentos"), segment()));
    expect(documentos.status).toBe(200);
    expect(documentos.body.data.total).toBe(facturasConFixture + 2);
    const tipos = documentos.body.data.items.map((item: { tipo: string; id: string }) => `${item.tipo}:${item.id}`);
    expect(tipos).toEqual(expect.arrayContaining([
      `FISCAL:${facturaId}`, `REMITO:${remitoR.body.data.id}`, `REMITO:${remitoX.body.data.id}`,
    ]));
    const soloRemitos = await json(await documentosRoute(request("/api/documentos?tipo=REMITO&clase=X"), segment()));
    expect(soloRemitos.body.data.items.map((item: { id: string }) => item.id)).toEqual([remitoX.body.data.id]);
    const soloFacturas = await json(await documentosRoute(request("/api/documentos?tipo=FACTURA"), segment()));
    expect(soloFacturas.body.data.items.every((item: { tipo: string }) => item.tipo === "FISCAL")).toBe(true);

    // PDF
    const pdf = await pdfRoute(request(`/api/remitos/${remitoR.body.data.id}/pdf`), segment({ id: remitoR.body.data.id }));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("Content-Disposition")).toBe('attachment; filename="remito-r-00002-00000001.pdf"');
    const document = await PDFDocument.load(new Uint8Array(await pdf.arrayBuffer()));
    expect(document.getTitle()).toBe("Remito R 00002-00000001");

    // Configuración con último emitido y sin facturas nuevas
    const final = await json(await getConfigRoute(request("/api/remitos/configuracion"), segment()));
    expect(final.body.data.ultimoEmitido).toEqual({ R: "R 00002-00000001", X: "X 00001-00000001" });
    expect(await contarFilas("facturas_electronicas")).toBe(facturasConFixture);
    expect(facturasConFixture).toBe(facturasAntes + 1);
  });
});
