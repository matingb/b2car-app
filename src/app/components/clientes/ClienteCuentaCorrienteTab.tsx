"use client";

import React, { useEffect, useState, useCallback } from "react";
import { css } from "@emotion/react";
import { ArrowDownLeft, ArrowUpRight, LayoutList, Table, Wallet } from "lucide-react";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import Card from "@/app/components/ui/Card";
import type { ClienteMovimientoCuenta } from "@/model/types";
import { clientesClient } from "@/clients/clientes/clientesClient";

type Props = {
  clienteId: string;
};

export default function ClienteCuentaCorrienteTab({ clienteId }: Props) {
  const [movimientos, setMovimientos] = useState<ClienteMovimientoCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desktopView, setDesktopView] = useState<"table" | "cards">("table");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientesClient.getCuentaCorriente(clienteId);
      if (res.error) throw new Error(res.error);
      setMovimientos(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando cuenta corriente");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId) void load();
  }, [clienteId, load]);

  if (loading) return <ListSkeleton rows={5} />;
  if (error) return <div css={styles.errorBox}>{error}</div>;

  if (movimientos.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Wallet size={36} color={COLOR.TEXT.TERTIARY} />
        <span style={styles.emptyTitle}>Sin movimientos en cuenta corriente</span>
        <span style={styles.emptySubtitle}>
          Los cargos de trabajos y los cobros registrados aparecerán en este extracto contable.
        </span>
      </Card>
    );
  }

  return (
    <div css={styles.container}>
      {/* Selector de vista (solo visible en pantallas > lg) */}
      <div css={styles.toggleContainer}>
        <div css={styles.toggleGroup} role="group" aria-label="Modo de visualización">
          <button
            type="button"
            onClick={() => setDesktopView("table")}
            css={[
              styles.toggleButton,
              desktopView === "table" && styles.toggleButtonActive,
            ]}
            aria-pressed={desktopView === "table"}
          >
            <Table size={15} />
            <span>Tabla</span>
          </button>
          <button
            type="button"
            onClick={() => setDesktopView("cards")}
            css={[
              styles.toggleButton,
              desktopView === "cards" && styles.toggleButtonActive,
            ]}
            aria-pressed={desktopView === "cards"}
          >
            <LayoutList size={15} />
            <span>Tarjetas</span>
          </button>
        </div>
      </div>

      {/* Vista Desktop: Tabla de extracto completa (cuando está en modo tabla) */}
      {desktopView === "table" && (
        <div css={styles.desktopContainer}>
          <table css={styles.table}>
            <thead>
              <tr>
                <th css={styles.th}>Fecha</th>
                <th css={styles.th}>Concepto / Detalle</th>
                <th css={styles.th}>Medio / Cuenta</th>
                <th css={[styles.th, styles.thRight]}>Debe (+)</th>
                <th css={[styles.th, styles.thRight]}>Haber (-)</th>
                <th css={[styles.th, styles.thRight]}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const isCargo = m.tipo_movimiento === "CARGO_ARREGLO";
                return (
                  <tr key={m.id + (m.tipo_movimiento || "")} css={styles.tr}>
                    <td css={styles.tdFecha}>
                      {m.fecha ? formatDateLabel(m.fecha) : "-"}
                    </td>
                    <td css={styles.td}>
                      <div css={styles.conceptoCell}>
                        {isCargo ? (
                          <ArrowUpRight size={16} color="#e11d48" />
                        ) : (
                          <ArrowDownLeft size={16} color="#16a34a" />
                        )}
                        <span>{m.concepto}</span>
                      </div>
                    </td>
                    <td css={styles.tdSec}>
                      {m.cuenta_nombre ? (
                        <span css={styles.cuentaTag}>{m.cuenta_nombre}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td css={[styles.td, styles.tdRight, styles.debitoText]}>
                      {m.debito > 0
                        ? formatArs(m.debito, { maxDecimals: 0, minDecimals: 0 })
                        : "-"}
                    </td>
                    <td css={[styles.td, styles.tdRight, styles.creditoText]}>
                      {m.credito > 0
                        ? formatArs(m.credito, { maxDecimals: 0, minDecimals: 0 })
                        : "-"}
                    </td>
                    <td css={[styles.td, styles.tdRight, styles.saldoText]}>
                      {m.saldo_acumulado != null
                        ? formatArs(m.saldo_acumulado, { maxDecimals: 0, minDecimals: 0 })
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista Cards: Se muestra en <= lg, o en > lg si se seleccionó 'cards' */}
      <div
        css={
          desktopView === "table" ? styles.cardsListResponsive : styles.cardsList
        }
      >
        {movimientos.map((m) => {
          const isDebito = m.debito > 0;
          const isCredito = m.credito > 0;
          return (
            <div key={m.id + (m.tipo_movimiento || "")} css={styles.cardItem}>
              <div css={styles.cardRowTop}>
                <span css={styles.cardConcepto}>{m.concepto}</span>
                <span
                  css={[
                    styles.cardMonto,
                    isDebito && styles.cardDebitoText,
                    isCredito && styles.cardCreditoText,
                  ]}
                >
                  {isDebito
                    ? `+ ${formatArs(m.debito, { maxDecimals: 0, minDecimals: 0 })}`
                    : isCredito
                    ? `- ${formatArs(m.credito, { maxDecimals: 0, minDecimals: 0 })}`
                    : "-"}
                </span>
              </div>
              <div css={styles.cardRowBottom}>
                <div css={styles.cardMetaLeft}>
                  <span>{m.fecha ? formatDateLabel(m.fecha) : "-"}</span>
                  {m.cuenta_nombre ? (
                    <>
                      <span css={styles.cardDot}>·</span>
                      <span css={styles.cuentaTag}>{m.cuenta_nombre}</span>
                    </>
                  ) : null}
                </div>
                {m.saldo_acumulado != null ? (
                  <span css={styles.cardSaldo}>
                    Saldo: {formatArs(m.saldo_acumulado, { maxDecimals: 0, minDecimals: 0 })}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  toggleContainer: css({
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  toggleGroup: css({
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "var(--color-background-subtle, #f1f5f9)",
    padding: 3,
    borderRadius: 8,
    border: "1px solid var(--color-border-subtle, #e2e8f0)",
    gap: 2,
  }),
  toggleButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--color-text-secondary, #64748b)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover": {
      color: "var(--color-text-primary, #1e293b)",
    },
  }),
  toggleButtonActive: css({
    backgroundColor: "var(--color-card-background, #ffffff)",
    color: "var(--color-text-primary, #0f172a)",
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  }),
  desktopContainer: css({
    backgroundColor: "var(--color-card-background, #ffffff)",
    border: "1px solid var(--color-border-subtle, #e2e8f0)",
    borderRadius: 12,
    overflowX: "auto",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  table: css({
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    textAlign: "left",
  }),
  th: css({
    padding: "12px 16px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--color-text-secondary, #64748b)",
    borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
    backgroundColor: "var(--color-background-subtle, #f8fafc)",
  }),
  thRight: css({
    textAlign: "right",
  }),
  tr: css({
    borderBottom: "1px solid var(--color-border-subtle, #f1f5f9)",
    "&:last-child": {
      borderBottom: "none",
    },
    "&:hover": {
      backgroundColor: "var(--color-background-subtle, #f8fafc)",
    },
  }),
  td: css({
    padding: "14px 16px",
    color: "var(--color-text-primary, #1e293b)",
  }),
  tdFecha: css({
    padding: "14px 16px",
    fontSize: 13,
    color: "var(--color-text-secondary, #64748b)",
    whiteSpace: "nowrap",
  }),
  tdSec: css({
    padding: "14px 16px",
    fontSize: 13,
    color: "var(--color-text-secondary, #64748b)",
  }),
  tdRight: css({
    textAlign: "right",
    whiteSpace: "nowrap",
  }),
  conceptoCell: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
  }),
  cuentaTag: css({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 12,
  }),
  debitoText: css({
    color: "var(--color-text-primary, #0f172a)",
    fontWeight: 600,
  }),
  creditoText: css({
    color: "#16a34a",
    fontWeight: 600,
  }),
  saldoText: css({
    fontWeight: 700,
    color: "var(--color-text-primary, #0f172a)",
  }),
  cardsList: css({
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--color-card-background, #ffffff)",
    border: "1px solid var(--color-border-subtle, #e2e8f0)",
    borderRadius: 12,
    overflow: "hidden",
  }),
  cardsListResponsive: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
      flexDirection: "column",
      backgroundColor: "var(--color-card-background, #ffffff)",
      border: "1px solid var(--color-border-subtle, #e2e8f0)",
      borderRadius: 12,
      overflow: "hidden",
    },
  }),
  cardItem: css({
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    borderBottom: "1px solid var(--color-border-subtle, #f1f5f9)",
    transition: "background-color 0.15s ease",
    "&:last-child": {
      borderBottom: "none",
    },
    "&:hover": {
      backgroundColor: "var(--color-background-subtle, #f8fafc)",
    },
  }),
  cardRowTop: css({
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  }),
  cardConcepto: css({
    fontSize: 14,
    fontWeight: 600,
    color: "var(--color-text-primary, #1e293b)",
    lineHeight: 1.35,
    minWidth: 0,
    wordBreak: "break-word",
  }),
  cardMonto: css({
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textAlign: "right",
  }),
  cardDebitoText: css({
    color: "#e11d48",
  }),
  cardCreditoText: css({
    color: "#16a34a",
  }),
  cardRowBottom: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    color: "var(--color-text-secondary, #64748b)",
  }),
  cardMetaLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    minWidth: 0,
  }),
  cardDot: css({
    color: "var(--color-text-tertiary, #94a3b8)",
  }),
  cardSaldo: css({
    fontSize: 12,
    fontWeight: 500,
    color: "var(--color-text-secondary, #64748b)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
  emptyCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    textAlign: "center" as const,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    maxWidth: 420,
  },
  errorBox: css({
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    fontSize: 14,
  }),
};
