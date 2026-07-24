"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import NumberInput from "@/app/components/ui/NumberInput";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import StockProgressBar from "@/app/components/stock/StockProgressBar";
import StockStatusIcon from "@/app/components/stock/StockStatusIcon";
import { getStockPercentage, getStockStatus, type StockStatus } from "@/lib/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { Pencil, Plus, Save, Trash, X } from "lucide-react";
import type {
  SaveProductoStockInput,
  SaveProductoStockResult,
  StockRegistro,
} from "@/app/providers/ProductosProvider";
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

function TallerIdentity({
  taller,
  configured,
  status,
}: {
  taller: Taller;
  configured: boolean;
  status?: StockStatus;
}) {
  return (
    <div css={styles.tallerBlock}>
      <StockStatusIcon status={configured ? status : undefined} />
      <div css={styles.tallerContent}>
        <div css={styles.tallerName}>{taller.nombre}</div>
        {taller.ubicacion ? <div css={styles.tallerMeta}>{taller.ubicacion}</div> : null}
      </div>
    </div>
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
  const [isEditing, setIsEditing] = useState(false);
  const configured = Boolean(stock);

  useEffect(() => {
    setDraft(createDraft(stock));
    setError(null);
    setIsEditing(false);
  }, [stock]);

  const levels = isEditing || !stock ? draft : createDraft(stock);
  const status = getStockStatus(levels);
  const valid = isValidDraft(draft);

  const startEditing = () => {
    setDraft(createDraft(stock));
    setError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(createDraft(stock));
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setError(null);
    if (!valid) {
      setError("El stock debe ser positivo y el mínimo no puede superar el máximo.");
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
      } else {
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const cardStyle = {
    ...(configured ? styles.configuredCard : styles.unconfiguredCard),
    ...(selected ? styles.selectedCard : {}),
  };

  return (
    <Card style={cardStyle}>
      {configured && !isEditing ? (
        <div css={styles.stockReadRow}>
          <TallerIdentity taller={taller} configured status={status} />
          <div css={styles.readDetails}>
            {renderValues(levels)}
            {renderProgress(levels, stock)}
          </div>
          <div css={styles.actions}>
            <IconButton
              icon={<Pencil />}
              onClick={startEditing}
              title="Editar stock"
              ariaLabel={`Editar stock de ${taller.nombre}`}
            />
          </div>
        </div>
      ) : isEditing ? (
        <div css={styles.stockEditRow}>
          <TallerIdentity taller={taller} configured={configured} status={configured ? status : undefined} />
          <div css={styles.editor}>
            {configured ? renderProgress(levels, stock) : null}
            {renderFields(draft, setDraft)}
          </div>
          <div css={styles.actions}>
            <Button
              icon={<Save size={17} />}
              text={saving ? "Guardando" : "Guardar"}
              onClick={handleSave}
              disabled={saving || !valid}
              hideTextOnMobile={false}
              style={styles.saveButton}
            />
            <IconButton
              icon={<X />}
              onClick={cancelEditing}
              title="Cancelar edición"
              ariaLabel="Cancelar edición"
              disabled={saving}
            />
            {configured ? (
              <IconButton
                icon={<Trash />}
                onClick={() => stock?.id && onDelete(stock.id, taller.nombre)}
                title="Eliminar stock"
                ariaLabel="Eliminar stock"
                hoverColor={COLOR.ICON.DANGER}
                disabled={saving}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div css={styles.unconfiguredRow}>
          <TallerIdentity taller={taller} configured={false} />
          <div css={styles.pendingState}>
            <span css={styles.pendingLabel}>Estado de inventario</span>
            <strong css={styles.pendingValue}>Pendiente de parámetros</strong>
          </div>
          <div css={styles.actions}>
            <Button
              icon={<Plus size={18} />}
              text="Configurar stock"
              onClick={startEditing}
              hideTextOnMobile={false}
              style={styles.configureButton}
            />
          </div>
        </div>
      )}
      {error ? <div css={styles.error}>{error}</div> : null}
    </Card>
  );
}

function renderFields(draft: Draft, setDraft: React.Dispatch<React.SetStateAction<Draft>>) {
  return (
    <div css={styles.fieldsGrid}>
      <div>
        <label css={styles.label}>Actual</label>
        <NumberInput
          minValue={0}
          allowDecimals={false}
          value={draft.stockActual}
          onValueChange={(next) => setDraft((prev) => ({ ...prev, stockActual: Math.round(next) }))}
          style={styles.input}
        />
      </div>
      <div>
        <label css={styles.label}>Mínimo</label>
        <NumberInput
          minValue={0}
          allowDecimals={false}
          value={draft.stockMinimo}
          onValueChange={(next) => setDraft((prev) => ({ ...prev, stockMinimo: Math.round(next) }))}
          style={styles.input}
        />
      </div>
      <div>
        <label css={styles.label}>Máximo</label>
        <NumberInput
          minValue={0}
          allowDecimals={false}
          value={draft.stockMaximo}
          onValueChange={(next) => setDraft((prev) => ({ ...prev, stockMaximo: Math.round(next) }))}
          style={styles.input}
        />
      </div>
    </div>
  );
}

function renderValues(levels: Draft) {
  return (
    <div css={styles.valuesGrid}>
      <StockValue label="Actual" value={`${levels.stockActual} uds.`} />
      <StockValue label="Mínimo" value={`${levels.stockMinimo} uds.`} />
      <StockValue label="Máximo" value={levels.stockMaximo > 0 ? `${levels.stockMaximo} uds.` : "Sin máximo"} />
    </div>
  );
}

function StockValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div css={styles.label}>{label}</div>
      <div css={styles.readValue}>{value}</div>
    </div>
  );
}

function renderProgress(levels: Draft, stock?: StockRegistro) {
  const capacity = Math.round(getStockPercentage(levels));

  return (
    <div css={styles.progressBlock}>
      <div css={styles.capacityHeader}>
        <span>Nivel de stock</span>
        <strong>{capacity}%</strong>
      </div>
      <StockProgressBar levels={levels} height={8} />
      {stock?.ultimaActualizacion ? <div css={styles.updatedAt}>Actualizado {stock.ultimaActualizacion}</div> : null}
    </div>
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
    return new Map(stocks.map((stock) => [stock.tallerId, stock] as const));
  }, [stocks]);

  const sortedTalleres = useMemo(
    () =>
      [...talleres].sort(
        (a, b) => Number(stockByTaller.has(b.id)) - Number(stockByTaller.has(a.id)),
      ),
    [stockByTaller, talleres],
  );

  if (!talleres.length) {
    return (
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div css={styles.empty}>No hay talleres configurados para este tenant.</div>
      </Card>
    );
  }

  return (
    <div css={styles.matrix}>
      {sortedTalleres.map((taller) => (
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
    gap: 12,
  }),
  configuredCard: {
    background: COLOR.BACKGROUND.SUBTLE,
  },
  unconfiguredCard: {
    border: `1px dashed ${COLOR.BORDER.DEFAULT}`,
    background: COLOR.BACKGROUND.SECONDARY,
    boxShadow: "none",
  },
  selectedCard: {
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
  },
  stockReadRow: css({
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.9fr) minmax(420px, 2.2fr) auto",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      gridTemplateColumns: "1fr",
      alignItems: "stretch",
    },
  }),
  stockEditRow: css({
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.9fr) minmax(360px, 2.2fr) auto",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      gridTemplateColumns: "1fr",
      alignItems: "stretch",
    },
  }),
  unconfiguredRow: css({
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) auto auto",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
      alignItems: "stretch",
    },
  }),
  tallerBlock: css({
    display: "flex",
    gap: 12,
    minWidth: 0,
    alignItems: "flex-start",
  }),
  tallerContent: css({
    minWidth: 0,
  }),
  tallerName: css({
    fontSize: 15,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  tallerMeta: css({
    marginTop: 3,
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  }),
  readDetails: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(180px, 0.85fr)",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  fieldsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  valuesGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
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
  readValue: css({
    fontSize: 15,
    fontWeight: 700,
  }),
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
  editor: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  }),
  pendingState: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      alignItems: "flex-start",
    },
  }),
  pendingLabel: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  pendingValue: css({
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
  }),
  actions: css({
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  }),
  saveButton: {
    minWidth: 116,
    height: 38,
    fontSize: 14,
  },
  configureButton: {
    minWidth: 156,
    height: 40,
  },
  error: css({
    marginTop: 10,
    color: COLOR.ICON.DANGER,
    fontSize: 13,
    fontWeight: 600,
  }),
  empty: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  }),
} as const;
