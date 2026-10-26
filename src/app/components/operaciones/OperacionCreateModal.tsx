"use client";

import React from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Tooltip from "@/app/components/ui/Tooltip";
import { formatArs } from "@/lib/format";
import { COLOR } from "@/theme/theme";
import { type OperacionModalProps, TIPOS_UI } from "./operacionModalTypes";
import { OperacionFormProvider, useOperacionForm } from "./OperacionFormContext";
import OperacionHeaderFields from "./OperacionHeaderFields";
import OperacionGastoForm from "./OperacionGastoForm";
import OperacionStockForm from "./OperacionStockForm";

function OperacionCreateModalContent({ onClose }: { onClose: () => void }) {
  const {
    open,
    tipo,
    setTipo,
    isContextualStock,
    isEditingGasto,
    canSubmit,
    isSubmitting,
    submitForm,
    importeTotal,
    stockDeliveryStatus,
  } = useOperacionForm();

  const title = isEditingGasto ? "Editar gasto" : "Nueva operación";

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={submitForm}
      showCloseButton
      hideFooter
      modalStyle={{ width: "min(880px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}
    >
      <div style={{ padding: "4px 0 16px", minHeight: "385px" }}>
        <div css={styles.topBar}>
          <div css={styles.segmentedGroup}>
            {(isContextualStock
              ? TIPOS_UI.filter((t) => t.tipo === "VENTA" || t.tipo === "COMPRA")
              : TIPOS_UI
            ).map((t) => {
              const isSelected = tipo === t.tipo;
              const isDisabled = Boolean(t.disabled);
              return (
                <Tooltip
                  key={t.tipo}
                  content={isDisabled ? "En construcción" : undefined}
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => !isDisabled && setTipo(t.tipo)}
                    disabled={isDisabled}
                    data-testid={`operaciones-create-tipo-${t.tipo}`}
                    css={[
                      styles.segmentedBtn,
                      isSelected && styles.segmentedBtnActive,
                      isDisabled && styles.segmentedBtnDisabled,
                    ]}
                  >
                    {t.label}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div css={styles.topTotalWrap}>
            <span css={styles.topTotalLabel}>TOTAL OPERACIÓN</span>
            <span css={styles.topTotalValue}>
              {formatArs(importeTotal, { maxDecimals: 0 })}
            </span>
          </div>
        </div>

        {/* Campos principales (3 columnas: Taller, Fecha, Cliente/Proveedor) */}
        <OperacionHeaderFields />

        {/* Detalle según tipo */}
        {tipo === "GASTO" ? <OperacionGastoForm /> : <OperacionStockForm />}

        {/* Footer integrado */}
        <div css={styles.modalFooter}>
          <div css={styles.footerLeft}>
            {tipo !== "GASTO" && (
              <div css={styles.stockStatus}>
                <span css={styles.stockStatusLabel}>Stock: </span>
                <span css={styles.stockStatusValue}>{stockDeliveryStatus}</span>
              </div>
            )}
          </div>

          <div css={styles.footerRight}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              css={styles.btnCancel}
              data-testid="modal-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              css={styles.btnSubmit}
              data-testid="modal-submit"
            >
              {isSubmitting
                ? "Guardando..."
                : isEditingGasto
                ? "Guardar cambios"
                : "Confirmar Operación →"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function OperacionCreateModal(props: OperacionModalProps) {
  return (
    <OperacionFormProvider {...props}>
      <OperacionCreateModalContent onClose={props.onClose} />
    </OperacionFormProvider>
  );
}

const styles = {
  topBar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  }),
  segmentedGroup: css({
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    padding: 4,
    borderRadius: 10,
    gap: 4,
  }),
  segmentedBtn: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 20px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "transparent",
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease-in-out",
    "&:hover:not(:disabled)": {
      color: "#0f172a",
    },
  }),
  segmentedBtnActive: css({
    backgroundColor: "#007991",
    color: "#ffffff !important",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  }),
  segmentedBtnDisabled: css({
    opacity: 0.5,
    cursor: "not-allowed",
  }),
  topTotalWrap: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  }),
  topTotalLabel: css({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "#64748b",
  }),
  topTotalValue: css({
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.1,
  }),
  modalFooter: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 24,
    paddingTop: 16,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    flexWrap: "wrap",
  }),
  footerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  stockStatus: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
  }),
  stockStatusLabel: css({
    color: "#64748b",
    marginRight: 4,
  }),
  stockStatusValue: css({
    color: "#047857",
    fontWeight: 700,
  }),
  footerRight: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginLeft: "auto",
  }),
  btnCancel: css({
    padding: "10px 18px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: "#ffffff",
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover:not(:disabled)": {
      backgroundColor: "#f8fafc",
      borderColor: "#cbd5e1",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
  btnSubmit: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#007991",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover:not(:disabled)": {
      backgroundColor: "#006477",
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
} as const;
