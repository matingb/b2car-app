"use client";

import React, { useContext, useState } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Tooltip from "@/app/components/ui/Tooltip";
import Toggle from "@/app/components/ui/Toggle";
import ComprobanteRecibidoOperacionModal from "@/app/components/comprobantesRecibidos/ComprobanteRecibidoOperacionModal";
import { TenantContext } from "@/app/providers/TenantProvider";
import { formatArs } from "@/lib/format";
import { Permission } from "@/lib/permissions";
import { COLOR } from "@/theme/theme";
import { type OperacionModalProps, TIPOS_UI } from "./operacionModalTypes";
import { type ComprobantePendiente, OperacionFormProvider, useOperacionForm } from "./OperacionFormContext";
import OperacionHeaderFields from "./OperacionHeaderFields";
import OperacionFacturaFields from "./OperacionFacturaFields";
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
    puedeCargarComprobante,
    factura,
  } = useOperacionForm();

  const title = isEditingGasto ? "Editar gasto" : "Nueva operación";
  const conFactura = puedeCargarComprobante && factura.activa;

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
          <div css={styles.topLeft}>
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

          {puedeCargarComprobante ? (
            <label css={styles.facturaSwitch} data-testid="operacion-cargar-con-factura">
              <Toggle
                checked={factura.activa}
                onChange={factura.setActiva}
                disabled={isSubmitting}
                label="Cargar con factura"
                data-testid="operacion-cargar-con-factura-switch"
              />
              <span css={styles.facturaSwitchLabel}>Cargar con factura</span>
            </label>
          ) : null}
          </div>

          <div css={styles.topTotalWrap}>
            <span css={styles.topTotalLabel}>TOTAL OPERACIÓN</span>
            <span css={styles.topTotalValue}>
              {formatArs(importeTotal, { maxDecimals: 0 })}
            </span>
          </div>
        </div>

        <OperacionHeaderFields />

        {conFactura ? <OperacionFacturaFields /> : null}

        {tipo === "GASTO" ? <OperacionGastoForm /> : <OperacionStockForm />}

        <div css={styles.modalFooter}>
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
                : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function OperacionCreateModal(props: OperacionModalProps) {
  // Sin TenantProvider (por ejemplo, en pruebas aisladas) no se ofrece la carga del documento.
  const tenant = useContext(TenantContext);
  const canCargarComprobante = tenant?.hasPermission(Permission.ComprobantesRecibidosEdit) ?? false;
  // Compra o gasto ya creado cuya factura no se pudo guardar. La operación se conserva y el
  // documento se reintenta con lo cargado (misma clave), o se agrega luego desde su detalle.
  const [pendiente, setPendiente] = useState<ComprobantePendiente | null>(null);

  return (
    <>
      <OperacionFormProvider
        {...props}
        open={props.open && !pendiente}
        onComprobantePendiente={canCargarComprobante ? setPendiente : undefined}
      >
        <OperacionCreateModalContent onClose={props.onClose} />
      </OperacionFormProvider>
      {pendiente ? (
        <ComprobanteRecibidoOperacionModal
          open
          operacionId={pendiente.operacionId}
          initialInput={pendiente.input}
          idempotencyKey={pendiente.idempotencyKey}
          initialError={pendiente.error}
          onClose={() => {
            setPendiente(null);
            props.onClose();
          }}
        />
      ) : null}
    </>
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
  topLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  }),
  facturaSwitch: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none",
  }),
  facturaSwitchLabel: css({
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
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
