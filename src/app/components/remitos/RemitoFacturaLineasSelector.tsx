"use client";

import RemitoLineasEditor, { lineasLibresPayload, nuevaLineaLibre, type LineaLibreForm } from "./RemitoLineasEditor";
import type { RemitoFacturaLineaDisponible } from "@/lib/remitos/types";

export type SeleccionLineasFactura = LineaLibreForm[];

const ORIGENES_BIENES = new Set(["REPUESTO", "VENTA"]);

/** Precarga los bienes disponibles de factura en líneas editables del remito. */
export function seleccionInicial(lineas: RemitoFacturaLineaDisponible[]): SeleccionLineasFactura {
  return lineas
    .filter((linea) => ORIGENES_BIENES.has(linea.origen) && linea.cantidadDisponible > 0)
    .map((linea) => nuevaLineaLibre({
      facturaLineaId: linea.id,
      codigo: linea.codigo ?? "",
      descripcion: linea.descripcion,
      cantidad: linea.cantidadDisponible,
    }));
}

export function lineasFacturaPayload(lineas: SeleccionLineasFactura) {
  return lineasLibresPayload(lineas);
}

/** `null` si el detalle propio conserva vínculos y cantidades válidas para la factura. */
export function validarSeleccionFactura(
  referencias: RemitoFacturaLineaDisponible[],
  lineas: SeleccionLineasFactura,
): string | null {
  if (lineas.length === 0) return "Agregá al menos un ítem al detalle del remito.";

  const porId = new Map(referencias.map((linea) => [linea.id, linea]));
  const cantidades = new Map<string, number>();
  for (const [index, linea] of lineas.entries()) {
    if (!linea.facturaLineaId || !porId.has(linea.facturaLineaId)) {
      return `Elegí la línea de factura de referencia para el ítem ${index + 1}.`;
    }
    if (!linea.descripcion.trim()) return `Completá la descripción del ítem ${index + 1}.`;
    if (!(linea.cantidad > 0)) return `La cantidad del ítem ${index + 1} debe ser mayor a 0.`;
    cantidades.set(linea.facturaLineaId, (cantidades.get(linea.facturaLineaId) ?? 0) + linea.cantidad);
  }

  for (const [facturaLineaId, cantidad] of cantidades) {
    const referencia = porId.get(facturaLineaId);
    if (referencia && cantidad > referencia.cantidadDisponible + 1e-9) {
      return `La cantidad total a remitir de "${referencia.descripcion}" no puede superar ${referencia.cantidadDisponible}.`;
    }
  }
  return null;
}

type Props = {
  lineas: RemitoFacturaLineaDisponible[];
  value: SeleccionLineasFactura;
  onChange: (next: SeleccionLineasFactura) => void;
  disabled?: boolean;
};

/** Editor de detalle del remito con la factura como referencia de cantidades. */
export default function RemitoFacturaLineasSelector({ lineas, value, onChange, disabled = false }: Props) {
  return (
    <RemitoLineasEditor
      lineasFactura={lineas}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
