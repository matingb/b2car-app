import React, { useMemo, useState } from "react";
import { COLOR } from "@/theme/theme";
import { toISODateLocal } from "@/app/components/turnos/utils/calendar";

type Props = {
  dia: Date;
  hour: number;
  width: number;
  onSelectDia?: (d: Date, hora?: string) => void;
};

export default function TurnosWeeklySlotCell({ dia, hour, width, onSelectDia }: Props) {
  const [hovered, setHovered] = useState(false);

  const hourLabel = useMemo(
    () => `${String(hour).padStart(2, "0")}:00`,
    [hour]
  );
  const testId = useMemo(
    () => `week-slot-${toISODateLocal(dia)}-${hourLabel}`,
    [dia, hourLabel]
  );

  const isClickable = Boolean(onSelectDia);

  return (
    <div
      style={{
        ...styles.base,
        width,
        ...(isClickable ? styles.clickable : undefined),
        ...(hovered && isClickable ? styles.hover : undefined),
      }}
      data-testid={testId}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onMouseEnter={isClickable ? () => setHovered(true) : undefined}
      onMouseLeave={isClickable ? () => setHovered(false) : undefined}
      onClick={isClickable ? () => onSelectDia?.(dia, hourLabel) : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDia?.(dia, hourLabel);
              }
            }
          : undefined
      }
    />
  );
}

const styles = {
  base: {
    borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  } as const,
  clickable: {
    cursor: "pointer",
  } as const,
  hover: {
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
} as const;

