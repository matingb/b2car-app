"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { MovimientoFinanciero } from "@/model/finanzas";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import { formatFinancialDate, formatMoney } from "./finanzasUtils";

type Props = {
  movimientos: MovimientoFinanciero[];
  loading?: boolean;
  error?: string | null;
};

function getMovementPresentation(tipo: string, importe: number) {
  switch (tipo) {
    case "saldo_inicial":
      return { label: "Saldo inicial", icon: <CircleDollarSign size={17} /> };
    case "transferencia_entrada":
      return { label: "Transferencia recibida", icon: <ArrowDownLeft size={17} /> };
    case "transferencia_salida":
      return { label: "Transferencia enviada", icon: <ArrowUpRight size={17} /> };
    case "gasto":
      return { label: "Gasto", icon: <ReceiptText size={17} /> };
    case "ingreso":
      return { label: "Ingreso", icon: <ArrowDownLeft size={17} /> };
    default:
      return {
        label: importe < 0 ? "Egreso" : "Movimiento",
        icon: <RotateCcw size={17} />,
      };
  }
}

export default function MovimientosFinancierosCard({ movimientos, loading = false, error }: Props) {
  const ordered = useMemo(
    () =>
      [...movimientos].sort(
        (left, right) => new Date(right.fecha).getTime() - new Date(left.fecha).getTime()
      ),
    [movimientos]
  );

  return (
    <section aria-labelledby="movimientos-financieros-title">
      <div style={styles.header}>
        <div>
          <h2 id="movimientos-financieros-title" style={styles.title}>
            Historial financiero
          </h2>
          <p style={styles.subtitle}>Ingresos, egresos y transferencias de esta cuenta.</p>
        </div>
        {!loading ? <span style={styles.count}>{ordered.length} movimientos</span> : null}
      </div>

      <Card style={styles.card}>
        {loading ? (
          <div style={styles.status} role="status">
            Cargando movimientos...
          </div>
        ) : error ? (
          <div style={styles.error} role="alert">
            {error}
          </div>
        ) : ordered.length === 0 ? (
          <div style={styles.status}>Todavía no hay movimientos registrados.</div>
        ) : (
          <div style={styles.list}>
            {ordered.map((movimiento) => {
              const importe = Number(movimiento.importe) || 0;
              const isIncome = importe >= 0;
              const presentation = getMovementPresentation(movimiento.tipo, importe);
              const color = isIncome ? COLOR.SEMANTIC.SUCCESS : COLOR.ICON.DANGER;
              const background = isIncome
                ? COLOR.BACKGROUND.SUCCESS_TINT
                : COLOR.BACKGROUND.DANGER_TINT;
              const categoria = movimiento.categoria?.replaceAll("_", " ").toLowerCase();

              return (
                <div key={movimiento.id} style={styles.row}>
                  <div style={styles.rowLeft}>
                    <div style={{ ...styles.iconWrap, color, background }}>{presentation.icon}</div>
                    <div style={styles.copy}>
                      <div style={styles.description}>
                        {movimiento.descripcion || presentation.label}
                      </div>
                      <div style={styles.meta}>
                        <span>{formatFinancialDate(movimiento.fecha)}</span>
                        <span style={styles.dot}>·</span>
                        <span>{presentation.label}</span>
                        {categoria ? (
                          <>
                            <span style={styles.dot}>·</span>
                            <span style={styles.category}>{categoria}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <strong style={{ ...styles.amount, color }}>
                    {isIncome ? "+" : "-"}
                    {formatMoney(Math.abs(importe))}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  subtitle: {
    margin: "4px 0 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  count: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    whiteSpace: "nowrap" as const,
  },
  card: { background: COLOR.BACKGROUND.SECONDARY },
  list: { display: "flex", flexDirection: "column" as const },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "11px 0",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 999,
    flexShrink: 0,
  },
  copy: { minWidth: 0 },
  description: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    fontWeight: 600,
    fontSize: 14,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 5,
    marginTop: 3,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  },
  dot: { opacity: 0.65 },
  category: { textTransform: "capitalize" as const },
  amount: {
    flexShrink: 0,
    fontSize: 14,
    whiteSpace: "nowrap" as const,
  },
  status: {
    minHeight: 98,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  error: {
    minHeight: 98,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.ICON.DANGER,
    fontSize: 14,
    textAlign: "center" as const,
  },
} as const;
