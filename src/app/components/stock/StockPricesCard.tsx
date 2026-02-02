"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { StockItem } from "@/model/stock";
import { formatArs } from "@/lib/format";
import NumberInput from "@/app/components/ui/NumberInput";

type Props = {
  item: StockItem;
  isEditing: boolean;
  draft: StockItem;
  onChange: (patch: Partial<StockItem>) => void;
};

export default function StockPricesCard({ item, isEditing, draft, onChange }: Props) {
  const base = isEditing ? draft : item;

  const margen = useMemo(() => {
    if (!base.costoUnitario) return 0;
    return ((base.precioUnitario - base.costoUnitario) / base.costoUnitario) * 100;
  }, [base.costoUnitario, base.precioUnitario]);

  const valorStock = useMemo(() => base.stockActual * base.costoUnitario, [base.stockActual, base.costoUnitario]);

  return (
    <div>
      <h3 style={styles.title}>Precios</h3>
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.grid}>
          <div>
            <div style={styles.label}>Precio compra</div>
            {isEditing ? (
              <NumberInput
                minValue={0}
                value={draft.costoUnitario}
                onValueChange={(next) => onChange({ costoUnitario: next })}
                style={styles.input}
              />
            ) : (
              <div style={styles.value}>{formatArs(item.costoUnitario, { maxDecimals: 0, minDecimals: 0 })}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Precio venta</div>
            {isEditing ? (
              <NumberInput
                minValue={0}
                value={draft.precioUnitario}
                onValueChange={(next) => onChange({ precioUnitario: next })}
                style={styles.input}
              />
            ) : (
              <div style={styles.value}>{formatArs(item.precioUnitario, { maxDecimals: 0, minDecimals: 0 })}</div>
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
            <div style={styles.label}>Valor en stock</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{formatArs(valorStock, { maxDecimals: 0, minDecimals: 0 })}</div>
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

