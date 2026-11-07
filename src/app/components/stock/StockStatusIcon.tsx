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
  boxSize?: number;
  borderRadius?: number | string;
  style?: React.CSSProperties;
  className?: string;
  "data-testid"?: string;
};

export default function StockStatusIcon({
  status,
  size = 20,
  boxSize = 38,
  borderRadius = 9,
  style,
  className,
  "data-testid": dataTestId,
}: Props) {
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
      className={className}
      data-testid={dataTestId}
      style={{
        width: boxSize,
        height: boxSize,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        borderRadius,
        color: presentation.color,
        background: presentation.background,
        ...style,
      }}
    >
      <StatusIcon size={size} aria-hidden />
    </span>
  );
}
