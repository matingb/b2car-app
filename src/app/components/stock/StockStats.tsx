"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import Tooltip from "@/app/components/ui/Tooltip";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { AlertCircle, AlertTriangle, CircleHelp, Package, TrendingUp } from "lucide-react";
import type { StockStatus } from "@/lib/stock";
import { css } from "@emotion/react";

type Stats = {
  total: number;
  criticos: number;
  bajos: number;
  altos: number;
};

type Props = {
  stats: Stats;
  selectedEstado: StockStatus | "";
  onSelectEstado: (estado: StockStatus | "") => void;
};

function StatCard({
  title,
  value,
  icon,
  color,
  selected,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      style={{
        border: selected ? `2px solid ${COLOR.ACCENT.PRIMARY}` : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            height: 42,
            width: 42,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLOR.BACKGROUND.SUBTLE,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: color ?? COLOR.TEXT.PRIMARY }}>
            {value}
          </div>
          <div style={{ fontSize: 13, color: COLOR.TEXT.SECONDARY }}>{title}</div>
        </div>
      </div>
    </Card>
  );
}

export default function StockStats({ stats, selectedEstado, onSelectEstado }: Props) {
  const tooltipContent = (
    <div css={styles.tooltipContent}>
      <span css={styles.tooltipLead}>El estado se calcula usando:</span>
      <div css={styles.formulaRow}>
        <span css={styles.badgeDisponible}>disponible</span>
        <span css={styles.operator}>−</span>
        <span css={styles.badgeReservado}>reservado</span>
        <span css={styles.operator}>+</span>
        <span css={styles.badgePendiente}>pendiente</span>
      </div>
    </div>
  );

  return (
    <div css={styles.container}>
      <div css={styles.header}>
        <span css={styles.title}>ESTADOS DE STOCK</span>
        <Tooltip
          content={tooltipContent}
          trigger="both"
          placement="top"
        >
          <button
            type="button"
            aria-label="El estado se calcula usando: disponible - reservado + pendiente"
            css={styles.helpButton}
            data-testid="stock-stats-calc-info"
          >
            <CircleHelp size={15} />
          </button>
        </Tooltip>
      </div>

      <div css={styles.grid}>
        <StatCard
          title="Total items"
          value={stats.total}
          icon={<Package size={24} color={COLOR.ICON.MUTED} />}
          selected={selectedEstado === ""}
          onClick={() => onSelectEstado("")}
        />

        <StatCard
          title="Sin stock"
          value={stats.criticos}
          icon={<AlertCircle size={24} color={COLOR.ICON.DANGER} />}
          color={COLOR.ICON.DANGER}
          selected={selectedEstado === "critico"}
          onClick={() => onSelectEstado(selectedEstado === "critico" ? "" : "critico")}
        />

        <StatCard
          title="Stock bajo"
          value={stats.bajos}
          icon={<AlertTriangle size={24} color={COLOR.STATUS.WARNING.TEXT} />}
          color={COLOR.STATUS.WARNING.TEXT}
          selected={selectedEstado === "bajo"}
          onClick={() => onSelectEstado(selectedEstado === "bajo" ? "" : "bajo")}
        />

        <StatCard
          title="Exceso stock"
          value={stats.altos}
          icon={<TrendingUp size={24} color={COLOR.ACCENT.PRIMARY} />}
          color={COLOR.ACCENT.PRIMARY}
          selected={selectedEstado === "alto"}
          onClick={() => onSelectEstado(selectedEstado === "alto" ? "" : "alto")}
        />
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  title: css({
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase",
  }),
  tooltipContent: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "2px 0",
  }),
  tooltipLead: css({
    fontSize: 11,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  }),
  formulaRow: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  }),
  badgeDisponible: css({
    padding: "2px 6px",
    borderRadius: 4,
    background: COLOR.STOCK.DISPONIBLE.BG_SUBTLE,
    color: COLOR.STOCK.DISPONIBLE.TEXT,
  }),
  badgeReservado: css({
    padding: "2px 6px",
    borderRadius: 4,
    background: COLOR.STOCK.RESERVADO.BG_SUBTLE,
    color: COLOR.STOCK.RESERVADO.TEXT,
  }),
  badgePendiente: css({
    padding: "2px 6px",
    borderRadius: 4,
    background: COLOR.STOCK.PENDIENTE.BG_SUBTLE,
    color: COLOR.STOCK.PENDIENTE.TEXT,
  }),
  operator: css({
    color: COLOR.ICON.MUTED,
    fontWeight: 700,
  }),
  helpButton: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    border: "none",
    background: "transparent",
    color: COLOR.ICON.MUTED,
    cursor: "pointer",
    borderRadius: 4,
    transition: "color 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
    "&:focus-visible": {
      outline: `2px solid ${COLOR.ACCENT.PRIMARY}`,
      outlineOffset: 1,
    },
  }),
  grid: css({
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
} as const;

