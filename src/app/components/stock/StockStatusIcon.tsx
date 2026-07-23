import React from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  PackagePlus,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { getStockStatusLabel, type StockStatus } from "@/lib/stock";
import { COLOR } from "@/theme/theme";

type StatusIconPresentation = {
  icon: LucideIcon;
  color: string;
  background: string;
};

const stockStatusPresentation: Record<StockStatus, StatusIconPresentation> = {
  critico: {
    icon: CircleX,
    color: COLOR.ICON.DANGER,
    background: COLOR.BACKGROUND.DANGER_TINT,
  },
  bajo: {
    icon: CircleAlert,
    color: COLOR.SEMANTIC.WARNING,
    background: COLOR.BACKGROUND.WARNING_TINT,
  },
  normal: {
    icon: CircleCheck,
    color: COLOR.SEMANTIC.SUCCESS,
    background: COLOR.BACKGROUND.SUCCESS_TINT,
  },
  alto: {
    icon: TrendingUp,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
};

type Props = {
  status?: StockStatus | null;
  size?: number;
};

export default function StockStatusIcon({ status, size = 20 }: Props) {
  const presentation = status
    ? stockStatusPresentation[status]
    : {
        icon: PackagePlus,
        color: COLOR.SEMANTIC.DISABLED,
        background: COLOR.BACKGROUND.DISABLED_TINT,
      };
  const StatusIcon = presentation.icon;
  const label = status ? getStockStatusLabel(status) : "Sin stock configurado";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        width: 38,
        height: 38,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        borderRadius: 9,
        color: presentation.color,
        background: presentation.background,
      }}
    >
      <StatusIcon size={size} aria-hidden />
    </span>
  );
}
