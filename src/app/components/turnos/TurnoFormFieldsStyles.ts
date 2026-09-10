import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

export const turnoFormStyles = {
  // --- Layout ---
  container: { display: "grid", gap: 12 },
  row: css({
    display: "flex",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      gap: 12,
    },
  }),
  field: {
    flex: 1,
    minWidth: 0,
  },
  inlineForm: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
  },

  // --- Labels ---
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  optionalTag: {
    fontSize: 11,
    color: COLOR.TEXT.TERTIARY,
    marginLeft: 4,
    fontWeight: 400,
  },

  // --- Inputs ---
  input: {
    width: "100%",
    height: 38,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    resize: "vertical" as const,
    fontFamily: "inherit",
    fontSize: 14,
    boxSizing: "border-box" as const,
  },

  // --- Date/Time picker shared ---
  calendarPickerContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },

  // --- Desktop picker ---
  desktopPicker: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  calendarPickerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  datePillWrapper: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    minHeight: 38,
    boxSizing: "border-box" as const,
  },
  datePillText: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  dropdownHoraInicio: {
    width: "105px",
    height: 38,
  },
  dropdownHoraFin: {
    width: "105px",
    height: 38,
  },
  pillSeparator: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 15,
  },
  allDayRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingLeft: 30,
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
    accentColor: COLOR.ACCENT.PRIMARY,
  },
  allDayLabel: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    userSelect: "none" as const,
  },

  // --- Mobile picker ---
  mobilePicker: css({
    display: "none",
    flexDirection: "column",
    gap: 16,
    padding: "6px 0",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "flex",
    },
  }),
  mobileAllDayRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mobileClockAndLabel: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  mobileSectionTitle: {
    fontSize: 15,
    color: COLOR.TEXT.PRIMARY,
    userSelect: "none" as const,
  },
  mobileDateTimeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 32,
    minHeight: 36,
  },
  mobileDateWrapper: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
    cursor: "pointer",
  },
  mobileDateText: {
    fontSize: 15,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 400,
  },
  mobileTimeRangeRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    paddingLeft: 32,
    flexWrap: "wrap" as const,
  },
  mobileTimeItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  mobileTimeLabel: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 400,
    userSelect: "none" as const,
  },
  dropdownHoraMobile: {
    width: "auto",
    minWidth: 95,
    height: 36,
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 400,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
  },
} as const;
