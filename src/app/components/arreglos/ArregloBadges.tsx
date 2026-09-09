"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import type { Arreglo, EstadoArreglo } from "@/model/types";
import ArregloEstadoBadge from "@/app/components/arreglos/ArregloEstadoBadge";
import ArregloPagoBadge from "@/app/components/arreglos/ArregloPagoBadge";
import ArregloFacturaBadge, { type FacturaBadgeData } from "@/app/components/arreglos/ArregloFacturaBadge";

export type ArregloBadgesData = {
  id: string;
  estado: EstadoArreglo;
  es_facturable?: boolean;
  esta_pago: boolean;
  total_cobrado?: number;
  saldo_pendiente?: number;
  precio_final: number;
  factura_electronica?: FacturaBadgeData | null;
};

export type ArregloBadgesProps = {
  arreglo: ArregloBadgesData;
  variant?: "footer" | "inline";
  size?: "sm" | "md";
  totalCalculado?: number;
  facturaElectronica?: FacturaBadgeData | null;
  canEmitFactura?: boolean;
  hidePagoTextOnMobile?: boolean;
  onStateChange?: (nextEstado: EstadoArreglo) => void;
  onPagoUpdated?: (updatedArreglo: Arreglo) => void;
  onFacturableChanged?: (esFacturable: boolean) => void;
  onOpenFacturaModal?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
};

export default function ArregloBadges({
  arreglo,
  variant = "inline",
  size = "md",
  totalCalculado,
  facturaElectronica,
  canEmitFactura = false,
  hidePagoTextOnMobile = false,
  onStateChange,
  onPagoUpdated,
  onFacturableChanged,
  onOpenFacturaModal,
  onOpenChange,
}: ArregloBadgesProps) {
  const isPresupuesto = arreglo.estado === "PRESUPUESTO";
  const resolvedFactura = facturaElectronica ?? arreglo.factura_electronica ?? null;
  const precioFinalCalculado = totalCalculado || arreglo.precio_final || 0;
  const saldoPendienteCalculado =
    arreglo.saldo_pendiente != null
      ? arreglo.saldo_pendiente
      : Math.max(0, precioFinalCalculado - (arreglo.total_cobrado || 0));

  // 1. Variante FOOTER (usada principalmente en tarjetas de lista como ArregloItem)
  if (variant === "footer") {
    return (
      <div css={styles.footerRow} data-isolate-hover="true">
        <div css={styles.footerLeft}>
          <ArregloEstadoBadge
            estado={arreglo.estado}
            size={size}
            arregloId={arreglo.id}
            onStateChange={onStateChange}
            onOpenChange={onOpenChange}
          />
        </div>
        {!isPresupuesto ? (
          <div css={styles.footerRight}>
            <ArregloFacturaBadge
              arregloId={arreglo.id}
              esFacturable={arreglo.es_facturable !== false}
              factura={resolvedFactura}
              onFacturableChanged={onFacturableChanged}
              onOpenFacturaModal={canEmitFactura ? onOpenFacturaModal : undefined}
              onOpenChange={onOpenChange}
              size={size}
            />
            <ArregloPagoBadge
              estado={arreglo.estado}
              estaPago={arreglo.esta_pago}
              totalCobrado={arreglo.total_cobrado}
              saldoPendiente={arreglo.saldo_pendiente}
              precioFinal={arreglo.precio_final}
              arregloId={arreglo.id}
              onPagoUpdated={onPagoUpdated}
              size={size}
              variant="footer"
            />
          </div>
        ) : null}
      </div>
    );
  }

  // 2. Variante INLINE (usada en ArregloSummaryCard u otros encabezados)
  return (
    <div css={styles.inlineRow}>
      <ArregloEstadoBadge
        estado={arreglo.estado}
        size={size}
        arregloId={arreglo.id}
        onStateChange={onStateChange}
        onOpenChange={onOpenChange}
      />
      {!isPresupuesto ? (
        <>
          <ArregloPagoBadge
            estado={arreglo.estado}
            estaPago={arreglo.esta_pago}
            totalCobrado={arreglo.total_cobrado}
            saldoPendiente={saldoPendienteCalculado}
            precioFinal={precioFinalCalculado}
            arregloId={arreglo.id}
            onPagoUpdated={onPagoUpdated}
            size={size}
            hideTextOnMobile={hidePagoTextOnMobile}
          />
          <ArregloFacturaBadge
            arregloId={arreglo.id}
            esFacturable={arreglo.es_facturable !== false}
            factura={resolvedFactura}
            onFacturableChanged={onFacturableChanged}
            onOpenFacturaModal={canEmitFactura ? onOpenFacturaModal : undefined}
            onOpenChange={onOpenChange}
            size={size}
          />
        </>
      ) : null}
    </div>
  );
}

const styles = {
  footerRow: css({
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  footerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  footerRight: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  inlineRow: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  }),
};
