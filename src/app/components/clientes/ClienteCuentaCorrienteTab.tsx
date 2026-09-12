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
                          <ArrowUpRight size={16} color={COLOR.SEMANTIC.DANGER} />
                        ) : (
                          <ArrowDownLeft size={16} color={COLOR.SEMANTIC.SUCCESS} />
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
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    padding: 3,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  toggleButtonActive: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  }),
  desktopContainer: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
    color: COLOR.TEXT.SECONDARY,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  }),
  thRight: css({
    textAlign: "right",
  }),
  tr: css({
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    "&:last-child": {
      borderBottom: "none",
    },
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  td: css({
    padding: "14px 16px",
    color: COLOR.TEXT.PRIMARY,
  }),
  tdFecha: css({
    padding: "14px 16px",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
  }),
  tdSec: css({
    padding: "14px 16px",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
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
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  debitoText: css({
    color: COLOR.SEMANTIC.DANGER,
    fontWeight: 600,
  }),
  creditoText: css({
    color: COLOR.SEMANTIC.SUCCESS,
    fontWeight: 600,
  }),
  saldoText: css({
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),
  cardsList: css({
    display: "flex",
    flexDirection: "column",
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden",
  }),
  cardsListResponsive: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
      flexDirection: "column",
      backgroundColor: COLOR.BACKGROUND.SECONDARY,
      border: `1px solid ${COLOR.BORDER.SUBTLE}`,
      borderRadius: 12,
      overflow: "hidden",
    },
  }),
  cardItem: css({
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    transition: "background-color 0.15s ease",
    "&:last-child": {
      borderBottom: "none",
    },
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
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
    color: COLOR.TEXT.PRIMARY,
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
    color: COLOR.SEMANTIC.DANGER,
  }),
  cardCreditoText: css({
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  cardRowBottom: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  }),
  cardMetaLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    minWidth: 0,
  }),
  cardDot: css({
    color: COLOR.TEXT.TERTIARY,
  }),
  cardSaldo: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
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
    backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 14,
  }),
};
