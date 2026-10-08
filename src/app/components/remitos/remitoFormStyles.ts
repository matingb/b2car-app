import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

/** Estilos de campos compartidos por los formularios de remitos (mismo lenguaje visual que facturación). */
export const remitoFormStyles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6, minWidth: 0 },
  label: { fontSize: 13, fontWeight: 500, color: COLOR.TEXT.SECONDARY },
  required: { color: REQUIRED_ICON_COLOR, fontWeight: 700 },
  input: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    minHeight: 72,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  hint: { margin: 0, fontSize: 12, color: COLOR.TEXT.TERTIARY },
} as const;
