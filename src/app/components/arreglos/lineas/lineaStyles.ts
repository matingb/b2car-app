import React from "react";
import { COLOR } from "@/theme/theme";

export type LineaVariant = "servicios" | "repuestos";

export function itemIconCircleStyle(variant: LineaVariant): React.CSSProperties {
  return {
    ...styles.itemIconCircleBase,
    background:
      variant === "repuestos"
        ? COLOR.BACKGROUND.SUCCESS_TINT
        : COLOR.BACKGROUND.INFO_TINT,
  };
}

export const styles = {
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  emptyState: {
    padding: 12,
    borderRadius: 12,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  itemCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    flexWrap: "wrap" as const,
    overflow: "clip",
  },
  itemIconCircleBase: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  itemSubTitle: {
    marginTop: 6,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  codePill: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 700,
    color: COLOR.TEXT.TERTIARY,
    background: COLOR.BACKGROUND.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    marginLeft: 8,
  },
  actionBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
  },
  confirmBtn: {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    cursor: "pointer",
    padding: 0,
  } as const,
  cancelBtn: {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.DANGER_TINT,
    cursor: "pointer",
    padding: 0,
  } as const,
  addRowBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 12,
    border: `2px dashed ${COLOR.BORDER.SUBTLE}`,
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
    cursor: "pointer",
  } as const,
  editorInput: {
    width: "100%",
    padding: "10px 12px",
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    fontSize: 14,
    height: 42,
  } as const,
  editorInputRight: {
    textAlign: "right" as const,
  } as const,
  editorGrid: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    alignItems: "center",
  } as const,
  warnBox: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  } as const,
} as const;

