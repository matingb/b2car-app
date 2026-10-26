"use client";

import React from "react";
import { css } from "@emotion/react";
import { ChevronDown, Clock, WalletCards } from "lucide-react";
import RegistrarPagoSection, {
  type PagoDraftItem,
} from "@/app/components/arreglos/RegistrarPagoSection";
import type { CuentaFinancieraDraft } from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

export interface PagoCondicionSectionProps {
  tipo: "VENTA" | "COMPRA" | "GASTO" | "ARREGLO";
  totalOperacion: number;
  cuentaFavorita: { id: string; nombre: string } | null;
  pagos: PagoDraftItem[];
  onAddPago: () => void;
  onRemovePago: (id: string) => void;
  onUpdatePago: (id: string, field: keyof PagoDraftItem, value: string) => void;
  onUpdatePagoCuentaDraft?: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
  noPagar?: boolean;
  onNoPagarChange?: (noPagar: boolean) => void;
  allowNoPagar?: boolean;
  loadingCuentas?: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  dataTestIdSimple?: string;
  dataTestIdToggle?: string;
}

export default function PagoCondicionSection({
  tipo,
  totalOperacion,
  cuentaFavorita,
  pagos,
  onAddPago,
  onRemovePago,
  onUpdatePago,
  onUpdatePagoCuentaDraft,
  noPagar = false,
  onNoPagarChange,
  allowNoPagar = true,
  loadingCuentas = false,
  showAdvanced,
  onToggleAdvanced,
  dataTestIdSimple = "cobro-simple",
  dataTestIdToggle = "cobro-advanced-toggle",
}: PagoCondicionSectionProps) {
  const isVenta = tipo === "VENTA" || tipo === "ARREGLO";
  const simpleLabel = isVenta
    ? "El cobro se acreditara en la cuenta favorita"
    : "El pago se debitara de la cuenta favorita";

  const totalIngresado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldoPendiente = Math.max(0, totalOperacion - totalIngresado);

  return (
    <div css={styles.container}>
      {/* Vista simple con cuenta favorita si no está expandido y no está en modo diferido */}
      {cuentaFavorita && !showAdvanced && !noPagar ? (
        <div css={styles.simplePayment} data-testid={dataTestIdSimple}>
          <div css={styles.simpleAccountIcon}>
            <WalletCards size={20} />
          </div>
          <div css={styles.simpleAccountText}>
            <span css={styles.simpleAccountLabel}>{simpleLabel}</span>
            <strong css={styles.simpleAccountName}>{cuentaFavorita.nombre}</strong>
            <span css={styles.simpleAccountAmount}>
              Importe: {formatArs(totalOperacion, { maxDecimals: 0 })}
            </span>
          </div>
        </div>
      ) : null}

      {/* Vista avanzada / repartida */}
      {(showAdvanced || !cuentaFavorita || noPagar) && (
        <div css={styles.advancedContainer}>
          {allowNoPagar && onNoPagarChange && (
            <div css={styles.noPagarRow}>
              <label css={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={noPagar}
                  onChange={(e) => onNoPagarChange(e.target.checked)}
                  data-testid="pago-no-pagar-checkbox"
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <span css={styles.checkboxText}>
                  {isVenta
                    ? "No registrar cobro ahora (a cobrar diferido)"
                    : "No registrar pago ahora (a pagar diferido)"}
                </span>
              </label>

              {noPagar && (
                <div css={styles.diferidoNotice} data-testid="pago-diferido-notice">
                  <Clock size={15} color={COLOR.TEXT.SECONDARY} />
                  <span>
                    La operación se guardará con saldo pendiente de{" "}
                    <strong>{formatArs(totalOperacion, { maxDecimals: 0 })}</strong> y no se debitará ni acreditará ninguna cuenta hoy.
                  </span>
                </div>
              )}
            </div>
          )}

          {!noPagar && (
            <>
              <RegistrarPagoSection
                pagos={pagos}
                loadingCuentas={loadingCuentas}
                onAddPago={onAddPago}
                onRemovePago={onRemovePago}
                onUpdatePago={onUpdatePago}
                onUpdatePagoCuentaDraft={onUpdatePagoCuentaDraft}
              />

              {totalOperacion > 0 && (
                <div css={styles.saldoResumenRow}>
                  {saldoPendiente > 0 ? (
                    <span css={styles.saldoPendienteText}>
                      Saldo pendiente por liquidar: <strong>{formatArs(saldoPendiente, { maxDecimals: 0 })}</strong>
                    </span>
                  ) : totalIngresado === totalOperacion ? (
                    <span css={styles.saldoCompletoText}>
                      ✓ Pago total cubierto
                    </span>
                  ) : (
                    <span css={styles.saldoExcedenteText}>
                      Atención: El importe ingresado supera el total de la operación por {formatArs(totalIngresado - totalOperacion, { maxDecimals: 0 })}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Botón desplegable / toggle */}
      {cuentaFavorita && (
        <button
          type="button"
          css={styles.advancedToggle}
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
          data-testid={dataTestIdToggle}
        >
          <span>
            {showAdvanced || noPagar
              ? "Usar cuenta favorita"
              : "Elegir otra cuenta o dividir el pago"}
          </span>
          <ChevronDown
            size={17}
            css={showAdvanced || noPagar ? styles.chevronOpen : undefined}
          />
        </button>
      )}
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  }),
  simplePayment: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
  }),
  simpleAccountIcon: css({
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: 10,
    color: COLOR.ACCENT.PRIMARY,
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
  }),
  simpleAccountText: css({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  simpleAccountLabel: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  simpleAccountName: css({
    color: COLOR.TEXT.PRIMARY,
    fontSize: 16,
    fontWeight: 700,
  }),
  simpleAccountAmount: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  }),
  advancedToggle: css({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "11px 14px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease",
    "&:hover": {
      background: COLOR.BACKGROUND.SECONDARY,
    },
  }),
  chevronOpen: css({
    transform: "rotate(180deg)",
  }),
  advancedContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  noPagarRow: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
  }),
  checkboxLabel: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none",
  }),
  checkboxText: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  diferidoNotice: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    paddingLeft: 24,
  }),
  saldoResumenRow: css({
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 8px",
    fontSize: 13,
  }),
  saldoPendienteText: css({
    color: COLOR.SEMANTIC.WARNING,
  }),
  saldoCompletoText: css({
    color: COLOR.SEMANTIC.SUCCESS,
    fontWeight: 600,
  }),
  saldoExcedenteText: css({
    color: COLOR.SEMANTIC.DANGER,
    fontWeight: 600,
  }),
} as const;
