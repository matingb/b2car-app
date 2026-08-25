"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { MovimientoFinanciero } from "@/model/finanzas";
import ScrollPage from "@/app/components/ui/ScrollPage";
import MovimientoFinancieroItem from "./MovimientoFinancieroItem";

type Props = {
  movimientos: MovimientoFinanciero[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export default function MovimientosFinancierosList({
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
              {movimientos.map((movimiento, index) => (
                <MovimientoFinancieroItem
                  key={movimiento.id}
                  movimiento={movimiento}
                  isLast={index === movimientos.length - 1}
                />
              ))}
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
  card: { background: COLOR.BACKGROUND.SECONDARY, paddingTop: 0, paddingBottom: 0 },
  list: { display: "flex", flexDirection: "column" as const },
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

