"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

export type ProductoPricesDraft = {
  costoUnitario: number;
  precioUnitario: number;
};

type Props = {
  costoUnitario: number;
  precioUnitario: number;
  stockTotal: number;
  isEditing: boolean;
  draft: ProductoPricesDraft;
  onChange: (patch: Partial<ProductoPricesDraft>) => void;
};

export default function ProductoPricesCard({
  costoUnitario,
  precioUnitario,
  stockTotal,
  isEditing,
  draft,
  onChange,
}: Props) {
  const baseCompra = isEditing ? draft.costoUnitario : costoUnitario;
  const baseVenta = isEditing ? draft.precioUnitario : precioUnitario;

  const margen = useMemo(() => {
    if (!baseCompra) return 0;
    return ((baseVenta - baseCompra) / baseCompra) * 100;
  }, [baseCompra, baseVenta]);

  const valorProducto = useMemo(() => stockTotal * baseCompra, [stockTotal, baseCompra]);

  return (
    <div>
      <h3 style={styles.title}>Precios</h3>
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.grid}>
          <div>
            <div style={styles.label}>Precio compra</div>
            {isEditing ? (
              <input
                type="number"
                style={styles.input}
                value={draft.costoUnitario}
                onChange={(e) => onChange({ costoUnitario: Number(e.target.value) || 0 })}
              />
            ) : (
              <div style={styles.value}>{formatArs(costoUnitario, { maxDecimals: 0, minDecimals: 0 })}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Precio venta</div>
            {isEditing ? (
              <input
                type="number"
                style={styles.input}
                value={draft.precioUnitario}
                onChange={(e) => onChange({ precioUnitario: Number(e.target.value) || 0 })}
              />
            ) : (
              <div style={styles.value}>{formatArs(precioUnitario, { maxDecimals: 0, minDecimals: 0 })}</div>
            )}
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.grid}>
          <div>
            <div style={styles.label}>Margen</div>
            <div style={{ ...styles.value, color: "#15803d" }}>{margen.toFixed(1)}%</div>
          </div>
          <div>
            <div style={styles.label}>Valor en producto</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {formatArs(valorProducto, { maxDecimals: 0, minDecimals: 0 })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  label: { fontSize: 13, color: COLOR.TEXT.SECONDARY, marginBottom: 6 },
  value: { fontSize: 14, fontWeight: 700 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  divider: {
    margin: "12px 0",
    height: 1,
    background: COLOR.BORDER.SUBTLE,
  },
} as const;

