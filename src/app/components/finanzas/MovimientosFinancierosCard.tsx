"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { MovimientoFinanciero } from "@/model/finanzas";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { formatFinancialDate, formatMoney } from "./finanzasUtils";

import ScrollPage from "@/app/components/ui/ScrollPage";

type Props = {
  movimientos: MovimientoFinanciero[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

const LABELS: Record<string, string> = {
  APERTURA_CUENTA: "Saldo inicial",
  GASTO: "Gasto",
  COBRO_ARREGLO: "Cobro de arreglo",
  COMPRA_STOCK: "Compra de stock",
  VENTA_STOCK: "Venta de stock",
  REVERSO: "Reverso",
};

const ICONS: Record<string, React.ReactNode> = {
  APERTURA_CUENTA: <CircleDollarSign size={17} />,
  GASTO: <ReceiptText size={17} />,
  COBRO_ARREGLO: <CircleDollarSign size={17} />,
  COMPRA_STOCK: <ShoppingCart size={17} />,
  VENTA_STOCK: <TrendingUp size={17} />,
  REVERSO: <RotateCcw size={17} />,
};

function getMovementPresentation(tipo: string, importe: number) {
  if (tipo === "TRANSFERENCIA") {
    return importe < 0
      ? { label: "Transferencia enviada", icon: <ArrowUpRight size={17} /> }
      : { label: "Transferencia recibida", icon: <ArrowDownLeft size={17} /> };
  }
  const label = LABELS[tipo];
  if (label) return { label, icon: ICONS[tipo] ?? <CircleDollarSign size={17} /> };
  return {
    label: importe < 0 ? "Egreso" : "Ingreso",
    icon: <CircleDollarSign size={17} />,
  };
}

export default function MovimientosFinancierosCard({
  movimientos,
  loading = false,
  error,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: Props) {
  return (
    <section aria-labelledby="movimientos-financieros-title">
      <div style={styles.header}>
        <div>
          <h2 id="movimientos-financieros-title" style={styles.title}>
            Historial financiero
          </h2>
          <p style={styles.subtitle}>Ingresos, egresos y transferencias de esta cuenta.</p>
        </div>
        {!loading ? <span style={styles.count}>{movimientos.length} movimientos</span> : null}
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
        ) : movimientos.length === 0 ? (
          <div style={styles.status}>Todavía no hay movimientos registrados.</div>
        ) : (
          <ScrollPage
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
            loadingMoreLabel="Cargando más movimientos..."
          >
            <div style={styles.list}>
              {movimientos.map((movimiento) => {
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
          </ScrollPage>
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
