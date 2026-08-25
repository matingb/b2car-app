"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

export interface ArregloTotalsFooterProps {
  subtotalServicios: number;
  subtotalRepuestos: number;
  total: number;
  totalCobrado?: number;
  saldoPendiente?: number;
}

export default function ArregloTotalsFooter({
  subtotalServicios,
  subtotalRepuestos,
  total,
  totalCobrado,
  saldoPendiente,
}: ArregloTotalsFooterProps) {
  const hasCobros = totalCobrado != null && totalCobrado > 0;
  const isFullyPaid = hasCobros && totalCobrado >= total && total > 0;
  const effectiveSaldo = saldoPendiente != null ? saldoPendiente : Math.max(0, total - (totalCobrado || 0));

  return (
    <div style={styles.totalFooter}>
      <div style={styles.totalsRow}>
        <div style={styles.totalsLeft}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.dotBlue} />
            <span style={{ color: COLOR.TEXT.SECONDARY }}>Servicios:</span>
            <span style={{ fontWeight: 600 }}>
              {formatArs(subtotalServicios, {
                maxDecimals: 0,
                minDecimals: 0,
              })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.dotGreen} />
            <span style={{ color: COLOR.TEXT.SECONDARY }}>Productos:</span>
            <span style={{ fontWeight: 600 }}>
              {formatArs(subtotalRepuestos, {
                maxDecimals: 0,
                minDecimals: 0,
              })}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: COLOR.TEXT.SECONDARY }}>Total del arreglo</div>
          <div style={styles.totalBig}>
            {formatArs(total, {
              maxDecimals: 0,
              minDecimals: 0,
            })}
          </div>
          {hasCobros ? (
            <div style={{ fontSize: 13, marginTop: 4, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>
                Cobrado: {formatArs(totalCobrado, { maxDecimals: 0 })}
              </span>
              {!isFullyPaid && effectiveSaldo > 0 ? (
                <>
                  <span style={{ color: COLOR.TEXT.TERTIARY }}>•</span>
                  <span style={{ color: "#d97706", fontWeight: 600 }}>
                    Pendiente: {formatArs(effectiveSaldo, { maxDecimals: 0 })}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles = {
  totalFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  totalsRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  totalsLeft: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap" as const,
  },
  dotBlue: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: COLOR.ACCENT.PRIMARY,
    display: "inline-block",
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#16a34a",
    display: "inline-block",
  },
  totalBig: {
    fontSize: 32,
    fontWeight: 700,
  },
} as const;
