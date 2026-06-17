"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import NumberInput from "@/app/components/ui/NumberInput";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import StockProgressBar from "@/app/components/stock/StockProgressBar";
import StockStatusPill from "@/app/components/stock/StockStatusPill";
import { getStockStatus } from "@/lib/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { Plus, Save, Trash } from "lucide-react";
import type { SaveProductoStockInput, SaveProductoStockResult, StockRegistro } from "@/app/providers/ProductosProvider";
import type { Taller } from "@/model/types";

type Props = {
  productoId: string;
  talleres: Taller[];
  stocks: StockRegistro[];
  selectedTallerId?: string;
  onSave: (input: SaveProductoStockInput) => Promise<SaveProductoStockResult>;
  onDelete: (stockId: string, tallerNombre: string) => Promise<boolean>;
};

type Draft = {
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
};

function createDraft(stock?: StockRegistro): Draft {
  return {
    stockActual: stock?.stockActual ?? 0,
    stockMinimo: stock?.stockMinimo ?? 0,
    stockMaximo: stock?.stockMaximo ?? 0,
  };
}

function isValidDraft(draft: Draft) {
  return (
    draft.stockActual >= 0 &&
    draft.stockMinimo >= 0 &&
    draft.stockMaximo >= 0 &&
    (draft.stockMinimo <= draft.stockMaximo || draft.stockMaximo === 0)
  );
}

function StockRow({
  productoId,
  taller,
  stock,
  selected,
  onSave,
  onDelete,
}: {
  productoId: string;
  taller: Taller;
  stock?: StockRegistro;
  selected: boolean;
  onSave: Props["onSave"];
  onDelete: Props["onDelete"];
}) {
  const [draft, setDraft] = useState<Draft>(() => createDraft(stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(createDraft(stock));
    setError(null);
  }, [stock]);

  const status = getStockStatus(draft);
  const valid = isValidDraft(draft);
  const configured = Boolean(stock);

  const handleSave = async () => {
    setError(null);
    if (!valid) {
      setError("El stock debe ser positivo y el minimo no puede superar el maximo.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({
        stockId: stock?.id,
        productoId,
        tallerId: taller.id,
        ...draft,
      });
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ ...(selected ? styles.selectedCard : {}) }}>
      <div css={styles.stockRow}>
        <div style={styles.tallerBlock}>
          <div style={styles.tallerName}>{taller.nombre}</div>
          <div style={styles.tallerMeta}>{configured ? "Stock configurado" : "Sin stock configurado"}</div>
          <div style={styles.statusWrap}>
            {draft.stockMaximo > 0 ? (
              <StockStatusPill status={status} small />
            ) : (
              <span style={styles.pendingPill}>Sin maximo</span>
            )}
          </div>
        </div>

        <div css={styles.fieldsGrid}>
          <div>
            <label style={styles.label}>Actual</label>
            <NumberInput
              minValue={0}
              allowDecimals={false}
              value={draft.stockActual}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, stockActual: Math.round(next) }))}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Minimo</label>
            <NumberInput
              minValue={0}
              allowDecimals={false}
              value={draft.stockMinimo}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, stockMinimo: Math.round(next) }))}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Maximo</label>
            <NumberInput
              minValue={0}
              allowDecimals={false}
              value={draft.stockMaximo}
              onValueChange={(next) => setDraft((prev) => ({ ...prev, stockMaximo: Math.round(next) }))}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.progressBlock}>
          <StockProgressBar levels={draft} height={8} />
          <div style={styles.updatedAt}>
            {stock?.ultimaActualizacion ? `Actualizado ${stock.ultimaActualizacion}` : "Pendiente de guardar"}
          </div>
        </div>

        <div style={styles.actions}>
          {configured ? (
            <>
              <IconButton
                icon={<Save />}
                onClick={handleSave}
                title="Guardar stock"
                ariaLabel="Guardar stock"
                disabled={saving || !valid}
              />
              <IconButton
                icon={<Trash />}
                onClick={() => stock?.id && onDelete(stock.id, taller.nombre)}
                title="Eliminar stock"
                ariaLabel="Eliminar stock"
                hoverColor={COLOR.ICON.DANGER}
                disabled={saving}
              />
            </>
          ) : (
            <Button
              icon={<Plus size={18} />}
              text={saving ? "Guardando" : "Configurar"}
              onClick={handleSave}
              disabled={saving || !valid}
              style={{ minWidth: 132, height: 40 }}
              hideTextOnMobile={false}
            />
          )}
        </div>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
    </Card>
  );
}

export default function ProductoStockMatrix({
  productoId,
  talleres,
  stocks,
  selectedTallerId,
  onSave,
  onDelete,
}: Props) {
  const stockByTaller = useMemo(() => {
    return new Map(stocks.map((s) => [s.tallerId, s] as const));
  }, [stocks]);

  if (!talleres.length) {
    return (
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.empty}>No hay talleres configurados para este tenant.</div>
      </Card>
    );
  }

  return (
    <div css={styles.matrix}>
      {talleres.map((taller) => (
        <StockRow
          key={taller.id}
          productoId={productoId}
          taller={taller}
          stock={stockByTaller.get(taller.id)}
          selected={selectedTallerId === taller.id}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

const styles = {
  matrix: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  selectedCard: {
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
  },
  stockRow: css({
    display: "grid",
    gridTemplateColumns: "1.1fr 1.5fr 1fr auto",
    gap: 12,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      gridTemplateColumns: "1fr",
      alignItems: "stretch",
    },
  }),
  tallerBlock: {
    minWidth: 0,
  },
  tallerName: {
    fontSize: 15,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  tallerMeta: {
    marginTop: 3,
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  statusWrap: {
    marginTop: 8,
  },
  pendingPill: {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 700,
  },
  fieldsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  label: {
    display: "block",
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  progressBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 7,
  },
  updatedAt: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  error: {
    marginTop: 10,
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    fontWeight: 600,
  },
  empty: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
} as const;
