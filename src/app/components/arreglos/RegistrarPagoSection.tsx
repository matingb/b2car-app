"use client";

import React, { useMemo } from "react";
import { css } from "@emotion/react";
import { Calendar, Plus, Trash2 } from "lucide-react";
import CuentaFinancieraAutocomplete, {
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/CuentaFinancieraAutocomplete";
import CuentaFinancieraFormFields, {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import NumberInput from "@/app/components/ui/NumberInput";

export { CREATE_CUENTA_VALUE };

export interface PagoDraftItem {
  id: string;
  cuentaId: string;
  monto: string;
  fecha: string;
  descripcion: string;
  cuentaDraft?: CuentaFinancieraDraft;
}

interface RegistrarPagoSectionProps {
  pagos: PagoDraftItem[];
  opcionesCuentas?: AutocompleteOption[];
  loadingCuentas?: boolean;
  onAddPago: () => void;
  onRemovePago: (id: string) => void;
  onUpdatePago: (id: string, field: keyof PagoDraftItem, value: string) => void;
  onUpdatePagoCuentaDraft?: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
}

export default function RegistrarPagoSection({
  pagos,
  opcionesCuentas,
  loadingCuentas = false,
  onAddPago,
  onRemovePago,
  onUpdatePago,
  onUpdatePagoCuentaDraft,
}: RegistrarPagoSectionProps) {
  const totalSum = useMemo(() => {
    return pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  }, [pagos]);

  return (
    <div css={styles.container}>
      <div css={styles.header}>
        <div css={styles.titleGroup}>
          <span css={styles.accentBar} />
          <h4 css={styles.titleText}>Registrar Pago</h4>
        </div>

        <div css={styles.totalBadge} data-testid="total-ingresado-badge">
          Total ingresado: {formatArs(totalSum, { maxDecimals: 0 })}
        </div>
      </div>

      <div css={styles.cardsList}>
        {pagos.map((pago, index) => {
          const isCreating = pago.cuentaId === CREATE_CUENTA_VALUE;

          return (
            <div key={pago.id} css={styles.card} data-testid={`pago-card-${index}`}>
              <div css={styles.cardTopRow}>
                <div css={styles.cuentaWrapper}>
                  <CuentaFinancieraAutocomplete
                    value={pago.cuentaId}
                    onChange={(val) => onUpdatePago(pago.id, "cuentaId", val)}
                    options={opcionesCuentas}
                    disabled={loadingCuentas}
                    hideClearButton
                    dataTestId={`pago-cuenta-${index}`}
                    inputStyle={styles.autocompleteInput}
                  />
                </div>

                <div css={styles.montoWrapper}>
                  <span css={styles.currencySymbol}>$</span>
                  <NumberInput
                    value={Number(pago.monto) || 0}
                    onValueChange={(val) => onUpdatePago(pago.id, "monto", String(val))}
                    minValue={0}
                    placeholder="0"
                    allowDecimals
                    allowEmptyWhileEditing
                    style={styles.montoInput}
                    data-testid={`pago-monto-${index}`}
                    required
                  />
                </div>

                <div css={styles.dateWrapper}>
                  <Calendar size={14} color={COLOR.TEXT.SECONDARY} />
                  <input
                    type="date"
                    value={pago.fecha}
                    onChange={(e) => onUpdatePago(pago.id, "fecha", e.target.value)}
                    css={styles.dateInput}
                    data-testid={`pago-fecha-${index}`}
                    required
                  />
                </div>

                <button
                  type="button"
                  css={styles.btnRemove}
                  onClick={() => onRemovePago(pago.id)}
                  title="Eliminar esta cuenta"
                  disabled={pagos.length <= 1}
                  data-testid={`pago-remove-${index}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {isCreating && (   
                <CuentaFinancieraFormFields
                  values={pago.cuentaDraft || EMPTY_CUENTA_FINANCIERA_DRAFT}
                  onChange={(patch) => onUpdatePagoCuentaDraft?.(pago.id, patch)}
                  showSaldoInicial={false}
                  showActivo={false}
                  compact
                  dataTestIdPrefix={`pago-cuenta-${index}`}
                />
              )}

              <div css={styles.cardBottomRow}>
                <input
                  type="text"
                  placeholder="Concepto o nota (opcional)..."
                  value={pago.descripcion}
                  onChange={(e) => onUpdatePago(pago.id, "descripcion", e.target.value)}
                  css={styles.descInput}
                  data-testid={`pago-descripcion-${index}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón de añadir otra cuenta con borde punteado */}
      <button
        type="button"
        css={styles.btnAddAccount}
        onClick={onAddPago}
        data-testid="btn-add-account"
      >
        <Plus size={15} />
        <span>Añadir otra cuenta</span>
      </button>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  }),
  titleGroup: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  accentBar: css({
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#0080a2",
  }),
  titleText: css({
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  totalBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 6,
    backgroundColor: "#e6f4f6",
    fontSize: 12,
    fontWeight: 600,
    color: "#0080a2",
  }),
  cardsList: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  card: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 12px",
    backgroundColor: "#ffffff",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
  }),
  cardTopRow: css({
    display: "grid",
    gridTemplateColumns: "1.8fr 1.1fr 1.2fr auto",
    gap: 8,
    alignItems: "center",
    "@media (max-width: 540px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  }),
  cuentaWrapper: css({
    minWidth: 0,
  }),
  autocompleteInput: {
    height: 38,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: "#ffffff",
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    padding: "0 10px",
  },
  montoWrapper: css({
    display: "flex",
    alignItems: "center",
    height: 38,
    padding: "0 10px",
    backgroundColor: "#ffffff",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    gap: 4,
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
    "&:focus-within": {
      borderColor: "#0080a2",
    },
  }),
  currencySymbol: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    userSelect: "none",
  }),
  montoInput: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    textAlign: "right" as const,
    outline: "none",
    padding: 0,
  },
  dateWrapper: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: 38,
    padding: "0 10px",
    backgroundColor: "#ffffff",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
    "&:focus-within": {
      borderColor: "#0080a2",
    },
  }),
  dateInput: css({
    width: "100%",
    height: "100%",
    border: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    cursor: "pointer",
    padding: 0,
  }),
  btnRemove: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    border: "none",
    background: "transparent",
    color: COLOR.TEXT.TERTIARY,
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover:not(:disabled)": {
      color: COLOR.SEMANTIC.DANGER,
      backgroundColor: "rgba(239, 68, 68, 0.08)",
    },
    "&:disabled": {
      opacity: 0.35,
      cursor: "not-allowed",
    },
  }),
  inlineCuentaContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    backgroundColor: "#f8fafc",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
  }),
  inlineCuentaHeader: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }),
  inlineCuentaTitle: css({
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  }),
  btnCancelInline: css({
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: COLOR.ACCENT.PRIMARY,
    cursor: "pointer",
    textDecoration: "underline",
    "&:hover": {
      opacity: 0.8,
    },
  }),
  cardBottomRow: css({
    width: "100%",
  }),
  descInput: css({
    width: "100%",
    height: 36,
    padding: "0 12px",
    backgroundColor: "#f8fafc",
    border: `1px solid #eef2f6`,
    borderRadius: 8,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
    "&::placeholder": {
      color: COLOR.TEXT.TERTIARY,
    },
    "&:focus": {
      backgroundColor: "#ffffff",
      borderColor: "#0080a2",
    },
  }),
  btnAddAccount: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "11px 16px",
    borderRadius: 10,
    border: "1.5px dashed rgba(0, 128, 162, 0.4)",
    backgroundColor: "rgba(0, 128, 162, 0.02)",
    color: "#0080a2",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease-in-out",
    "&:hover": {
      backgroundColor: "rgba(0, 128, 162, 0.08)",
      borderColor: "#0080a2",
    },
  }),
} as const;
