"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import { AlertCircle, AlertTriangle, Package, TrendingUp } from "lucide-react";
import type { StockStatus } from "@/lib/stock";

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
  return (
    <div style={styles.grid}>
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
        icon={<AlertTriangle size={24 } color={"#b45309"} />}
        color={"#b45309"}
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
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
    marginTop: 12,
  },
} as const;

