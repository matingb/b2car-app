"use client";

import React from "react";
import { css } from "@emotion/react";
import { ChevronDown, FileText, Plus, RotateCcw, WalletCards } from "lucide-react";
import RegistrarPagoSection, {
  type PagoDraftItem,
} from "@/app/components/arreglos/RegistrarPagoSection";
import type { CuentaFinancieraDraft } from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { COLOR } from "@/theme/theme";
import { formatArs, formatNumberAr } from "@/lib/format";

export interface PagoCondicionSectionProps {
  tipo: "VENTA" | "COMPRA" | "GASTO" | "ARREGLO";
  totalOperacion: number;
  cuentaFavorita: { id: string; nombre: string } | null;
  contraparteNombre?: string;
  pagos: PagoDraftItem[];
  onAddPago: () => void;
  onRemovePago: (id: string) => void;
  onUpdatePago: (id: string, field: keyof PagoDraftItem, value: string) => void;
  onUpdatePagoCuentaDraft?: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
  onRestoreFavorita?: () => void;
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
  contraparteNombre,
  pagos,
  onAddPago,
  onRemovePago,
  onUpdatePago,
  onUpdatePagoCuentaDraft,
  onRestoreFavorita,
  noPagar: _noPagar,
  onNoPagarChange: _onNoPagarChange,
  allowNoPagar: _allowNoPagar = true,
  loadingCuentas = false,
  showAdvanced,
  onToggleAdvanced,
  dataTestIdSimple = "cobro-simple",
  dataTestIdToggle = "cobro-advanced-toggle",
}: PagoCondicionSectionProps) {
  const isVenta = tipo === "VENTA" || tipo === "ARREGLO";
  const simpleLabel = isVenta
    ? "El cobro se acreditará en la cuenta favorita"
    : "El pago se debitará de la cuenta favorita";

  const isDiferido = pagos.length === 0;
  const contraparte = contraparteNombre?.trim() || (isVenta ? "cliente" : "proveedor");
  const formattedImporte = formatNumberAr(totalOperacion > 0 ? totalOperacion : 0, {
    maxDecimals: 0,
  });

  return (
    <div css={styles.container}>
      {cuentaFavorita && !showAdvanced && !isDiferido ? (
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

      {(showAdvanced || !cuentaFavorita || isDiferido) && (
        <div css={styles.advancedContainer}>
          {isDiferido ? (
            <div css={styles.emptyCard} data-testid="pago-empty-notice">
              <div css={styles.emptyCardTop}>
                <div css={styles.emptyDocIconBox}>
                  <FileText size={20} strokeWidth={1.8} />
                </div>
                <div css={styles.emptyNoticeContent}>
                  <div css={styles.emptyNoticeHeader}>
                    <strong css={styles.emptyNoticeTitle}>
                      Operación a Cuenta Corriente
                    </strong>
                    <span css={styles.emptyNoticeBadge}>
                      {isVenta ? "Sin cobro inmediato" : "Sin pago inmediato"}
                    </span>
                  </div>
                  <p css={styles.emptyNoticeText}>
                    El importe de <strong>$ {formattedImporte}</strong> se imputará
                    como saldo pendiente en la cuenta corriente de{" "}
                    <strong>{contraparte}</strong>. No se registrará ningún
                    movimiento financiero en esta fecha.
                  </p>
                </div>
              </div>

              <div css={styles.emptyActionsRow}>
                <button
                  type="button"
                  css={styles.btnAddAccount}
                  onClick={onAddPago}
                  data-testid="btn-add-account"
                >
                  <Plus size={15} />
                  <span>{isVenta ? "Registrar un cobro" : "Registrar un pago"}</span>
                </button>

                {cuentaFavorita && onRestoreFavorita && (
                  <button
                    type="button"
                    css={styles.btnRestore}
                    onClick={onRestoreFavorita}
                    data-testid="btn-restore-favorita"
                  >
                    <RotateCcw size={14} />
                    <span>Usar {cuentaFavorita.nombre}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <RegistrarPagoSection
              pagos={pagos}
              loadingCuentas={loadingCuentas}
              onAddPago={onAddPago}
              onRemovePago={onRemovePago}
              onUpdatePago={onUpdatePago}
              onUpdatePagoCuentaDraft={onUpdatePagoCuentaDraft}
            />
          )}
        </div>
      )}

      {cuentaFavorita && !isDiferido && (
        <button
          type="button"
          css={styles.advancedToggle}
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
          data-testid={dataTestIdToggle}
        >
          <span>
            {showAdvanced
              ? `Usar cuenta favorita (${cuentaFavorita.nombre})`
              : isVenta
              ? "Elegir otra cuenta, dividir o diferir el cobro"
              : "Elegir otra cuenta, dividir o diferir el pago"}
          </span>
          <ChevronDown
            size={17}
            css={showAdvanced ? styles.chevronOpen : undefined}
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
  emptyCard: css({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "16px 20px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 14,
  }),
  emptyCardTop: css({
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  }),
  emptyDocIconBox: css({
    width: 40,
    height: 40,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#64748b",
  }),
  emptyNoticeContent: css({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }),
  emptyNoticeHeader: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  emptyNoticeTitle: css({
    fontSize: 15,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.3,
  }),
  emptyNoticeBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 9999,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: "#475569",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.2,
  }),
  emptyNoticeText: css({
    margin: 0,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.5,
    "& strong": {
      fontWeight: 600,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  emptyActionsRow: css({
    display: "flex",
    gap: 12,
    alignItems: "center",
  }),
  btnAddAccount: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1.5px dashed rgba(0, 128, 162, 0.45)",
    backgroundColor: "transparent",
    color: "#0080a2",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease-in-out",
    "&:hover": {
      backgroundColor: "rgba(0, 128, 162, 0.06)",
      borderColor: "#0080a2",
    },
  }),
  btnRestore: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: "#ffffff",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SECONDARY,
      borderColor: COLOR.BORDER.DEFAULT,
    },
  }),
} as const;
