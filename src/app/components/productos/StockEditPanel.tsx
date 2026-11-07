"use client";

import React from "react";
import NumberInput from "@/app/components/ui/NumberInput";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import StockProgressBar from "@/app/components/stock/StockProgressBar";
import { getStockPercentage, type StockLevels } from "@/lib/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { Save, Trash, X } from "lucide-react";
import type { StockRegistro } from "@/app/providers/ProductosProvider";
import type { Taller } from "@/model/types";

type StockEditState = {
  draft: StockLevels;
  setDraft: React.Dispatch<React.SetStateAction<StockLevels>>;
  saving: boolean;
  error: string | null;
  configured: boolean;
  levels: StockLevels;
  valid: boolean;
  cancelEditing: () => void;
  handleSave: () => Promise<void>;
};

type Props = {
  taller: Taller;
  stock?: StockRegistro;
  stockState: StockEditState;
  onDelete: (stockId: string, tallerNombre: string) => Promise<boolean>;
  variant: "table" | "card";
  identityNode: React.ReactNode;
};

export default function StockEditPanel({
  taller,
  stock,
  stockState,
  onDelete,
  variant,
  identityNode,
}: Props) {
  const {
    draft,
    setDraft,
    saving,
    error,
    configured,
    levels,
    valid,
    cancelEditing,
    handleSave,
  } = stockState;

  const capacity = Math.round(getStockPercentage(levels));

  const saveButton = (
    <Button
      icon={<Save size={16} />}
      text={saving ? "Guardando" : "Guardar"}
      onClick={handleSave}
      disabled={saving || !valid}
      hideTextOnMobile={false}
      style={styles.saveButton}
    />
  );

  const cancelButton = (
    <IconButton
      icon={<X />}
      onClick={cancelEditing}
      title="Cancelar edición"
      ariaLabel="Cancelar edición"
      disabled={saving}
    />
  );

  const deleteButton = configured ? (
    <IconButton
      icon={<Trash />}
      onClick={() => stock?.id && onDelete(stock.id, taller.nombre)}
      title="Eliminar stock"
      ariaLabel="Eliminar stock"
      hoverColor={COLOR.ICON.DANGER}
      disabled={saving}
    />
  ) : null;

  const body = (
    <>
      <div css={styles.fieldsGrid}>
        <div>
          <label css={styles.label}>Físico</label>
          <NumberInput
            minValue={0}
            allowDecimals={false}
            value={draft.stockActual}
            onValueChange={(next) =>
              setDraft((prev) => {
                const stockActual = Math.round(next);
                const reservado = Number(prev.stockReservado) || 0;
                return {
                  ...prev,
                  stockActual,
                  stockDisponible: stockActual - reservado,
                };
              })
            }
            style={styles.input}
          />
          {configured ? (
            <span css={styles.ajusteHelpText}>
              Editar la cantidad registra un ajuste
            </span>
          ) : null}
        </div>
        <div>
          <label css={styles.label}>Mínimo</label>
          <NumberInput
            minValue={0}
            allowDecimals={false}
            value={draft.stockMinimo}
            onValueChange={(next) =>
              setDraft((prev) => ({ ...prev, stockMinimo: Math.round(next) }))
            }
            style={styles.input}
          />
        </div>
        <div>
          <label css={styles.label}>Máximo</label>
          <NumberInput
            minValue={0}
            allowDecimals={false}
            value={draft.stockMaximo}
            onValueChange={(next) =>
              setDraft((prev) => ({ ...prev, stockMaximo: Math.round(next) }))
            }
            style={styles.input}
          />
        </div>
      </div>

      {configured ? (
        <div css={styles.progressBlock}>
          <div css={styles.capacityHeader}>
            <span>Nivel de stock</span>
            <strong>{capacity}%</strong>
          </div>
          <StockProgressBar levels={levels} height={6} />
          {stock?.ultimaActualizacion ? (
            <div css={styles.updatedAt}>Actualizado {stock.ultimaActualizacion}</div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (variant === "table") {
    return (
      <div css={styles.inlineEditPanel}>
        <div css={styles.editHeaderRow}>
          {identityNode}
          <div css={styles.actions}>
            {saveButton}
            {cancelButton}
            {deleteButton}
          </div>
        </div>
        <div css={styles.editBody}>{body}</div>
        {error ? <div css={styles.error}>{error}</div> : null}
      </div>
    );
  }

  return (
    <>
      <div css={styles.cardHeader}>
        {identityNode}
        {cancelButton}
      </div>
      <div css={styles.editContent}>{body}</div>
      <div css={styles.cardEditFooter}>
        <div>{deleteButton}</div>
        {saveButton}
      </div>
      {error ? <div css={styles.error}>{error}</div> : null}
    </>
  );
}

const styles = {
  inlineEditPanel: css({
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "8px 4px",
  }),
  editHeaderRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  }),
  cardHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  }),
  editBody: css({
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: 20,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  editContent: css({
    display: "flex",
    flexDirection: "column",
    gap: 14,
  }),
  cardEditFooter: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  }),
  fieldsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  label: css({
    display: "block",
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }),
  input: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  progressBlock: css({
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
  }),
  capacityHeader: css({
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
  }),
  updatedAt: css({
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
  }),
  actions: css({
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  }),
  saveButton: {
    minWidth: 110,
    height: 36,
    fontSize: 14,
  },
  error: css({
    marginTop: 8,
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    fontWeight: 600,
  }),
  ajusteHelpText: css({
    display: "block",
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
    marginTop: 4,
    lineHeight: 1.2,
  }),
} as const;

