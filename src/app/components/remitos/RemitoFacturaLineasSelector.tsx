"use client";

import Checkbox from "@/app/components/ui/Checkbox";
import NumberInput from "@/app/components/ui/NumberInput";
import { formatRemitoCantidad, type RemitoFacturaLineaDisponible } from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";
import { remitoFormStyles } from "./remitoFormStyles";

export type SeleccionLineaFactura = {
  seleccionada: boolean;
  cantidad: number;
  observaciones: string;
};

export type SeleccionLineasFactura = Record<string, SeleccionLineaFactura>;

const ORIGENES_BIENES = new Set(["REPUESTO", "VENTA"]);

/**
 * Selección inicial: los bienes (repuestos y ventas) con saldo quedan marcados por la cantidad disponible.
 * Servicios, formularios y ajustes quedan sin marcar pero seleccionables. Es solo una ayuda de carga.
 */
export function seleccionInicial(lineas: RemitoFacturaLineaDisponible[]): SeleccionLineasFactura {
  return Object.fromEntries(lineas.map((linea) => [linea.id, {
    seleccionada: ORIGENES_BIENES.has(linea.origen) && linea.cantidadDisponible > 0,
    cantidad: linea.cantidadDisponible,
    observaciones: "",
  }]));
}

export function lineasFacturaPayload(lineas: RemitoFacturaLineaDisponible[], seleccion: SeleccionLineasFactura) {
  return lineas
    .filter((linea) => seleccion[linea.id]?.seleccionada)
    .map((linea) => ({
      facturaLineaId: linea.id,
      observaciones: seleccion[linea.id].observaciones.trim() || null,
      cantidad: seleccion[linea.id].cantidad,
    }));
}

/** `null` si la selección es válida; si no, el motivo para mostrar. */
export function validarSeleccionFactura(
  lineas: RemitoFacturaLineaDisponible[],
  seleccion: SeleccionLineasFactura,
): string | null {
  const elegidas = lineas.filter((linea) => seleccion[linea.id]?.seleccionada);
  if (elegidas.length === 0) return "Seleccioná al menos una línea de la factura.";
  const invalida = elegidas.find((linea) => {
    const cantidad = seleccion[linea.id].cantidad;
    return !(cantidad > 0) || cantidad > linea.cantidadDisponible + 1e-9;
  });
  return invalida ? `La cantidad de "${invalida.descripcion}" debe ser mayor a 0 y no superar ${formatRemitoCantidad(invalida.cantidadDisponible)}.` : null;
}

type Props = {
  lineas: RemitoFacturaLineaDisponible[];
  value: SeleccionLineasFactura;
  onChange: (next: SeleccionLineasFactura) => void;
  disabled?: boolean;
};

/** Líneas de la factura con cantidades facturadas, remitidas y disponibles. Nunca muestra precios. */
export default function RemitoFacturaLineasSelector({ lineas, value, onChange, disabled = false }: Props) {
  const update = (id: string, changes: Partial<SeleccionLineaFactura>) =>
    onChange({ ...value, [id]: { ...value[id], ...changes } });

  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th} aria-label="Incluir" />
            <th style={styles.th}>Código</th>
            <th style={styles.th}>Descripción</th>
            <th style={styles.thRight}>Facturada</th>
            <th style={styles.thRight}>Remitida</th>
            <th style={styles.thRight}>Disponible</th>
            <th style={styles.thRight}>A remitir</th>
            <th style={styles.th}>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => {
            const seleccion = value[linea.id] ?? { seleccionada: false, cantidad: 0, observaciones: "" };
            const agotada = linea.cantidadDisponible <= 0;
            const excede = seleccion.seleccionada && seleccion.cantidad > linea.cantidadDisponible + 1e-9;
            return (
              <tr key={linea.id} data-testid={`remito-factura-linea-${linea.id}`} style={agotada ? styles.rowDisabled : undefined}>
                <td style={styles.td}>
                  <Checkbox
                    id={`remito-factura-linea-check-${linea.id}`}
                    label=""
                    checked={seleccion.seleccionada}
                    disabled={disabled || agotada}
                    onChange={(seleccionada) => update(linea.id, { seleccionada })}
                  />
                </td>
                <td style={styles.td}>{linea.codigo ?? "-"}</td>
                <td style={styles.td}>
                  {linea.descripcion}
                  {agotada ? <div style={styles.agotada}>Totalmente remitida</div> : null}
                </td>
                <td style={styles.tdRight}>{formatRemitoCantidad(linea.cantidadFacturada)}</td>
                <td style={styles.tdRight}>{formatRemitoCantidad(linea.cantidadRemitida)}</td>
                <td style={styles.tdRight}><strong>{formatRemitoCantidad(linea.cantidadDisponible)}</strong></td>
                <td style={styles.tdRight}>
                  <NumberInput
                    aria-label={`Cantidad a remitir de ${linea.descripcion}`}
                    value={seleccion.cantidad}
                    minValue={0}
                    max={linea.cantidadDisponible}
                    step="0.0001"
                    disabled={disabled || agotada || !seleccion.seleccionada}
                    onValueChange={(cantidad) => update(linea.id, { cantidad: Math.min(cantidad, linea.cantidadDisponible) })}
                    style={{ ...styles.quantity, ...(excede ? styles.quantityError : {}) }}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    aria-label={`Observaciones de ${linea.descripcion}`}
                    maxLength={500}
                    disabled={disabled || agotada || !seleccion.seleccionada}
                    value={seleccion.observaciones}
                    onChange={(event) => update(linea.id, { observaciones: event.target.value })}
                    style={{ ...remitoFormStyles.input, height: 36, minWidth: 140 }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  wrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 820 },
  th: {
    textAlign: "left" as const,
    padding: "9px 8px",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  thRight: {
    textAlign: "right" as const,
    padding: "9px 8px",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  td: { padding: "8px", fontSize: 13, borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`, verticalAlign: "middle" as const },
  tdRight: {
    padding: "8px",
    fontSize: 13,
    textAlign: "right" as const,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    verticalAlign: "middle" as const,
  },
  rowDisabled: { opacity: 0.6 },
  agotada: { fontSize: 11, color: COLOR.TEXT.TERTIARY, marginTop: 2 },
  quantity: { width: 96, height: 36, textAlign: "right" as const },
  quantityError: { borderColor: COLOR.SEMANTIC.DANGER },
} as const;
