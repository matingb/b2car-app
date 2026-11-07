"use client";

import React, { useEffect, useMemo, useState } from "react";
import Table from "@/app/components/ui/Table";
import IconButton from "@/app/components/ui/IconButton";
import StockProgressBar from "@/app/components/stock/StockProgressBar";
import StockStatusIcon from "@/app/components/stock/StockStatusIcon";
import StockEditPanel from "@/app/components/productos/StockEditPanel";
import {
  getStockBreakdown,
  getStockPercentage,
  getStockStatus,
  getStockStatusLabel,
  isValidStockLevels,
  type StockLevels,
  type StockStatus,
} from "@/lib/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useIsTabletOrMobile } from "@/app/hooks/useMediaQuery";
import { css } from "@emotion/react";
import { MapPin, Pencil, Plus, Sliders } from "lucide-react";
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
  layoutMode?: "auto" | "table" | "card";
  onSave: (input: SaveProductoStockInput) => Promise<SaveProductoStockResult>;
  onDelete: (stockId: string, tallerNombre: string) => Promise<boolean>;
  onRegisterOperation: (stock: StockRegistro, taller: Taller) => void;
};

const STOCK_METRICS = [
  { key: "fisico", label: "FÍSICO", shortLabel: "FÍSICO", color: COLOR.STOCK.FISICO },
  { key: "disponible", label: "DISPONIBLE", shortLabel: "DISP.", color: COLOR.STOCK.DISPONIBLE },
  { key: "reservado", label: "RESERVADO", shortLabel: "RES.", color: COLOR.STOCK.RESERVADO },
  { key: "pendiente", label: "PENDIENTE", shortLabel: "PEND.", color: COLOR.STOCK.PENDIENTE },
] as const;

function createStockDraft(stock?: StockRegistro): StockLevels {
  return {
    stockActual: stock?.stockActual ?? 0,
    stockMinimo: stock?.stockMinimo ?? 0,
    stockMaximo: stock?.stockMaximo ?? 0,
  };
}

function useStockState({
  productoId,
  taller,
  stock,
  onSave,
}: {
  productoId: string;
  taller: Taller;
  stock?: StockRegistro;
  onSave: Props["onSave"];
}) {
  const [draft, setDraft] = useState<StockLevels>(() => createStockDraft(stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const configured = Boolean(stock);

  useEffect(() => {
    setDraft(createStockDraft(stock));
    setError(null);
    setIsEditing(false);
  }, [stock]);

  const levels = isEditing || !stock ? draft : createStockDraft(stock);
  const status = getStockStatus(levels);
  const valid = isValidStockLevels(draft);

  const startEditing = () => {
    setDraft(createStockDraft(stock));
    setError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(createStockDraft(stock));
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

  const breakdown = getStockBreakdown(stock, levels.stockActual);
  const percentage = Math.round(getStockPercentage(levels));
  const statusLabel = getStockStatusLabel(status);

  return {
    draft,
    setDraft,
    saving,
    error,
    isEditing,
    configured,
    levels,
    status,
    valid,
    startEditing,
    cancelEditing,
    handleSave,
    breakdown,
    percentage,
    statusLabel,
  };
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
      <StockStatusIcon status={configured ? status : undefined} size={18} />
      <div css={styles.tallerContent}>
        <div css={styles.tallerName} title={taller.nombre}>
          {taller.nombre}
        </div>
        {taller.ubicacion ? (
          <div css={styles.tallerMeta} title={taller.ubicacion}>
            <MapPin size={12} css={styles.mapPinIcon} />
            <span>{taller.ubicacion}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StockViewActions({
  stock,
  taller,
  configured,
  onRegisterOperation,
  onStartEditing,
}: {
  stock?: StockRegistro;
  taller: Taller;
  configured: boolean;
  onRegisterOperation: Props["onRegisterOperation"];
  onStartEditing: () => void;
}) {
  return (
    <div css={styles.actions}>
      {configured && stock ? (
        <IconButton
          icon={<Plus size={16} />}
          onClick={() => onRegisterOperation(stock, taller)}
          data-testid={`producto-stock-${stock.id}-registrar-operacion`}
          title="Registrar operación"
          ariaLabel={`Registrar operación en ${taller.nombre}`}
        />
      ) : null}
      <IconButton
        icon={configured ? <Pencil size={16} /> : <Plus size={16} />}
        onClick={onStartEditing}
        title={configured ? "Editar stock" : "Configurar stock"}
        ariaLabel={
          configured
            ? `Editar stock de ${taller.nombre}`
            : `Configurar stock en ${taller.nombre}`
        }
      />
    </div>
  );
}

type StockItemProps = {
  productoId: string;
  taller: Taller;
  stock?: StockRegistro;
  selected: boolean;
  onSave: Props["onSave"];
  onDelete: Props["onDelete"];
  onRegisterOperation: Props["onRegisterOperation"];
};

function StockTableRow({
  productoId,
  taller,
  stock,
  selected,
  onSave,
  onDelete,
  onRegisterOperation,
}: StockItemProps) {
  const stockState = useStockState({ productoId, taller, stock, onSave });
  const {
    isEditing,
    configured,
    levels,
    status,
    startEditing,
    breakdown,
    percentage,
    statusLabel,
  } = stockState;

  const identityNode = (
    <TallerIdentity
      taller={taller}
      configured={configured}
      status={status}
    />
  );

  if (isEditing) {
    return (
      <Table.Row css={[styles.tableRowEdit, selected && styles.tableRowSelected]}>
        <Table.Cell colSpan={8} css={styles.tdEdit}>
          <StockEditPanel
            taller={taller}
            stock={stock}
            stockState={stockState}
            onDelete={onDelete}
            variant="table"
            identityNode={identityNode}
          />
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Table.Row css={selected && styles.tableRowSelected}>
      <Table.Cell css={styles.tdTaller}>{identityNode}</Table.Cell>

      {configured ? (
        <>
          {STOCK_METRICS.map(({ key, color }) => (
            <Table.Cell
              key={key}
              align="center"
              weight={700}
              css={[styles.tableMetricCell, { color }]}
            >
              {breakdown[key]}
            </Table.Cell>
          ))}

          <Table.Cell align="center" css={styles.tdMinMax}>
            {levels.stockMinimo} / {levels.stockMaximo > 0 ? levels.stockMaximo : "∞"}
          </Table.Cell>

          <Table.Cell css={styles.tdNivelStock}>
            <div css={styles.tableProgressBlock}>
              <div css={styles.tableProgressHeader}>
                <span css={styles.tableStatusLabel}>{statusLabel}</span>
                <span css={styles.tablePercentage}>{percentage}%</span>
              </div>
              <StockProgressBar levels={levels} height={5} />
            </div>
          </Table.Cell>
        </>
      ) : (
        <>
          {STOCK_METRICS.map(({ key }) => (
            <Table.Cell key={key} align="center" css={styles.tdEmptyValue}>
              —
            </Table.Cell>
          ))}

          <Table.Cell align="center" css={styles.tdEmptyValue}>
            —
          </Table.Cell>

          <Table.Cell css={styles.tdNivelStock}>
            <div css={styles.tableUnconfiguredState}>
              <span css={styles.unconfiguredBadge}>Pendiente de parámetros</span>
            </div>
          </Table.Cell>
        </>
      )}

      <Table.Cell align="right" css={styles.tdAcciones}>
        <StockViewActions
          stock={stock}
          taller={taller}
          configured={configured}
          onRegisterOperation={onRegisterOperation}
          onStartEditing={startEditing}
        />
      </Table.Cell>
    </Table.Row>
  );
}

function StockCard({
  productoId,
  taller,
  stock,
  selected,
  onSave,
  onDelete,
  onRegisterOperation,
}: StockItemProps) {
  const stockState = useStockState({ productoId, taller, stock, onSave });
  const {
    isEditing,
    configured,
    levels,
    status,
    startEditing,
    breakdown,
    percentage,
  } = stockState;

  const identityNode = (
    <TallerIdentity
      taller={taller}
      configured={configured}
      status={status}
    />
  );

  if (isEditing) {
    return (
      <div css={[styles.card, selected && styles.cardSelected]}>
        <StockEditPanel
          taller={taller}
          stock={stock}
          stockState={stockState}
          onDelete={onDelete}
          variant="card"
          identityNode={identityNode}
        />
      </div>
    );
  }

  return (
    <div
      css={[
        styles.card,
        !configured && styles.cardUnconfigured,
        selected && styles.cardSelected,
      ]}
    >
      <div css={styles.cardHeader}>
        {identityNode}
        <StockViewActions
          stock={stock}
          taller={taller}
          configured={configured}
          onRegisterOperation={onRegisterOperation}
          onStartEditing={startEditing}
        />
      </div>

      <div css={styles.cardMetricsGrid}>
        {STOCK_METRICS.map(({ key, shortLabel, color }) => (
          <div key={key} css={styles.cardMetricItem}>
            <span css={styles.cardMetricLabel}>{shortLabel}</span>
            <span
              css={[
                styles.cardMetricValue,
                configured ? { color } : styles.cardMetricValueEmpty,
              ]}
            >
              {configured ? breakdown[key] : "—"}
            </span>
          </div>
        ))}
      </div>

      {configured ? (
        <div css={styles.cardBottom}>
          <div css={styles.cardLimitsRow}>
            <div css={styles.cardLimitsLeft}>
              <Sliders size={13} css={styles.slidersIcon} />
              <span>
                Mín: <strong>{levels.stockMinimo}</strong> · Máx:{" "}
                <strong>{levels.stockMaximo > 0 ? levels.stockMaximo : "∞"}</strong>
              </span>
            </div>
            <span css={styles.cardPercentage}>{percentage}%</span>
          </div>
          <StockProgressBar levels={levels} height={5} />
        </div>
      ) : (
        <div css={styles.cardBottomUnconfigured}>
          <span css={styles.unconfiguredBadge}>Pendiente de parámetros</span>
        </div>
      )}
    </div>
  );
}

export default function ProductoStockMatrix({
  productoId,
  talleres,
  stocks,
  selectedTallerId,
  layoutMode = "auto",
  onSave,
  onDelete,
  onRegisterOperation,
}: Props) {
  const isTabletDetected = useIsTabletOrMobile(BREAKPOINTS.lg);
  const isTablet =
    layoutMode === "card"
      ? true
      : layoutMode === "table"
        ? false
        : isTabletDetected;

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
      <div css={styles.emptyCard}>
        <div css={styles.empty}>No hay talleres configurados para este tenant.</div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div css={styles.cardsContainer}>
        {sortedTalleres.map((taller) => (
          <StockCard
            key={taller.id}
            productoId={productoId}
            taller={taller}
            stock={stockByTaller.get(taller.id)}
            selected={selectedTallerId === taller.id}
            onSave={onSave}
            onDelete={onDelete}
            onRegisterOperation={onRegisterOperation}
          />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <Table.Header>
        <Table.Head css={styles.thTaller}>TALLER / SUCURSAL</Table.Head>
        <Table.Head align="center">FÍSICO</Table.Head>
        <Table.Head align="center">DISPONIBLE</Table.Head>
        <Table.Head align="center">RESERVADO</Table.Head>
        <Table.Head align="center">PENDIENTE</Table.Head>
        <Table.Head align="center">MÍN / MÁX</Table.Head>
        <Table.Head css={styles.thNivelStock}>NIVEL DE STOCK</Table.Head>
        <Table.Head align="right" css={styles.thAcciones}>
          ACCIONES
        </Table.Head>
      </Table.Header>
      <Table.Body>
        {sortedTalleres.map((taller) => (
          <StockTableRow
            key={taller.id}
            productoId={productoId}
            taller={taller}
            stock={stockByTaller.get(taller.id)}
            selected={selectedTallerId === taller.id}
            onSave={onSave}
            onDelete={onDelete}
            onRegisterOperation={onRegisterOperation}
          />
        ))}
      </Table.Body>
    </Table>
  );
}

const styles = {
  thTaller: css({ minWidth: 220 }),
  thNivelStock: css({ minWidth: 180, width: 230 }),
  thAcciones: css({ width: 100, paddingRight: 20 }),

  tableRowSelected: css({ background: "rgba(0, 128, 162, 0.04)" }),
  tableRowEdit: css({ background: COLOR.BACKGROUND.SUBTLE }),

  tdTaller: css({ minWidth: 200 }),
  tableMetricCell: css({ fontSize: 16 }),
  tdEmptyValue: css({
    fontSize: 15,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
    userSelect: "none",
  }),
  tdMinMax: css({ fontSize: 13, color: COLOR.TEXT.SECONDARY }),
  tdNivelStock: css({ minWidth: 180 }),
  tableUnconfiguredState: css({
    display: "flex",
    alignItems: "center",
  }),
  unconfiguredBadge: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 9px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    whiteSpace: "nowrap",
  }),
  tdAcciones: css({ paddingRight: 20 }),
  tdEdit: css({ padding: 16 }),

  tableProgressBlock: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  }),
  tableProgressHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    lineHeight: 1,
  }),
  tableStatusLabel: css({ color: COLOR.TEXT.SECONDARY, fontWeight: 500 }),
  tablePercentage: css({ color: COLOR.TEXT.PRIMARY, fontWeight: 700 }),

  cardsContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  card: css({
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 14,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  }),
  cardUnconfigured: css({
    border: `1px dashed ${COLOR.BORDER.DEFAULT}`,
    boxShadow: "none",
  }),
  cardSelected: css({ border: `2px solid ${COLOR.ACCENT.PRIMARY}` }),
  cardHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  }),
  cardMetricsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    textAlign: "center",
    padding: "8px 0",
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  cardMetricItem: css({
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "center",
  }),
  cardMetricLabel: css({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: COLOR.TEXT.SECONDARY,
  }),
  cardMetricValue: css({
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.2,
  }),
  cardMetricValueEmpty: css({
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
  }),
  cardBottom: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }),
  cardBottomUnconfigured: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  }),
  cardLimitsRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  }),
  cardLimitsLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    "& strong": { color: COLOR.TEXT.PRIMARY, fontWeight: 600 },
  }),
  slidersIcon: css({ color: COLOR.TEXT.SECONDARY }),
  cardPercentage: css({
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),

  tallerBlock: css({
    display: "flex",
    gap: 12,
    minWidth: 0,
    alignItems: "center",
  }),
  tallerContent: css({ minWidth: 0 }),
  tallerName: css({
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  tallerMeta: css({
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  mapPinIcon: css({ color: "#94a3b8", flexShrink: 0 }),
  actions: css({
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  }),
  emptyCard: css({
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
  }),
  empty: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  }),
} as const;
