const WHITE = "#ffffff";
const BLACK = "#111111";

const GRAY_100 = "#f9f9f9";
const GRAY_200 = "#f5f7f9";
const GRAY_300 = "#dedede";
const GRAY_400 = "#d1d5db";
const GRAY_500 = "#cccccc";
const GRAY_600 = "#6b7280";
const GRAY_650 = "#7F7F7F";

const ACCENT_PRIMARY = "#0080a2";
const ACCENT_SECONDARY = "#007995";
const ACCENT_HOVER = "#006f87";

const RED_DANGER = "#8B0000";
export const REQUIRED_ICON_COLOR = "#DD0000";
const ALERT_YELLOW = "#f0bf00";

const STATUS_SUCCESS_BG_SUBTLE = "rgba(34, 197, 94, 0.12)";
const STATUS_SUCCESS_TEXT = "#16a34a";
const STATUS_SUCCESS_SOLID = "#16a34a";
const STATUS_SUCCESS_BORDER = "#16a34a";

const STATUS_WARNING_BG_SUBTLE = "rgba(245, 158, 11, 0.12)";
const STATUS_WARNING_TEXT = "#d97706";
const STATUS_WARNING_SOLID = "#d97706";
const STATUS_WARNING_BORDER = "#d97706";

const STATUS_DANGER_BG_SUBTLE = "rgba(239, 68, 68, 0.12)";
const STATUS_DANGER_TEXT = "#dc2626";
const STATUS_DANGER_SOLID = "#dc2626";
const STATUS_DANGER_BORDER = "#dc2626";

const STATUS_INFO_BG_SUBTLE = "rgba(59, 130, 246, 0.12)";
const STATUS_INFO_TEXT = "#2563eb";
const STATUS_INFO_SOLID = "#2563eb";
const STATUS_INFO_BORDER = "#2563eb";

const STATUS_PRIMARY_BG_SUBTLE = "rgba(0, 128, 162, 0.12)";

const BACKGROUND_PRIMARY = GRAY_200;
const BACKGROUND_SECONDARY = WHITE;
const BACKGROUND_SUBTLE = GRAY_100;

const STATUS_NEUTRAL_BG_SUBTLE = BACKGROUND_SUBTLE;
const STATUS_NEUTRAL_TEXT = GRAY_600;
const STATUS_NEUTRAL_SOLID = GRAY_600;
const STATUS_NEUTRAL_BORDER = GRAY_300;

const STATUS_SUCCESS = {
    BG_SUBTLE: STATUS_SUCCESS_BG_SUBTLE,
    TEXT: STATUS_SUCCESS_TEXT,
    TEXT_SUBTLE: STATUS_SUCCESS_TEXT,
    SOLID_BG: STATUS_SUCCESS_SOLID,
    SOLID_TEXT: WHITE,
    BORDER: STATUS_SUCCESS_BORDER,
    bgSubtle: STATUS_SUCCESS_BG_SUBTLE,
    textSubtle: STATUS_SUCCESS_TEXT,
    solidBg: STATUS_SUCCESS_SOLID,
    solidText: WHITE,
    borderColor: STATUS_SUCCESS_BORDER,
} as const;

const STATUS_WARNING = {
    BG_SUBTLE: STATUS_WARNING_BG_SUBTLE,
    TEXT: STATUS_WARNING_TEXT,
    TEXT_SUBTLE: STATUS_WARNING_TEXT,
    SOLID_BG: STATUS_WARNING_SOLID,
    SOLID_TEXT: WHITE,
    BORDER: STATUS_WARNING_BORDER,
    bgSubtle: STATUS_WARNING_BG_SUBTLE,
    textSubtle: STATUS_WARNING_TEXT,
    solidBg: STATUS_WARNING_SOLID,
    solidText: WHITE,
    borderColor: STATUS_WARNING_BORDER,
} as const;

const STATUS_DANGER = {
    BG_SUBTLE: STATUS_DANGER_BG_SUBTLE,
    TEXT: STATUS_DANGER_TEXT,
    TEXT_SUBTLE: STATUS_DANGER_TEXT,
    SOLID_BG: STATUS_DANGER_SOLID,
    SOLID_TEXT: WHITE,
    BORDER: STATUS_DANGER_BORDER,
    bgSubtle: STATUS_DANGER_BG_SUBTLE,
    textSubtle: STATUS_DANGER_TEXT,
    solidBg: STATUS_DANGER_SOLID,
    solidText: WHITE,
    borderColor: STATUS_DANGER_BORDER,
} as const;

const STATUS_INFO = {
    BG_SUBTLE: STATUS_INFO_BG_SUBTLE,
    TEXT: STATUS_INFO_TEXT,
    TEXT_SUBTLE: STATUS_INFO_TEXT,
    SOLID_BG: STATUS_INFO_SOLID,
    SOLID_TEXT: WHITE,
    BORDER: STATUS_INFO_BORDER,
    bgSubtle: STATUS_INFO_BG_SUBTLE,
    textSubtle: STATUS_INFO_TEXT,
    solidBg: STATUS_INFO_SOLID,
    solidText: WHITE,
    borderColor: STATUS_INFO_BORDER,
} as const;

const STATUS_NEUTRAL = {
    BG_SUBTLE: STATUS_NEUTRAL_BG_SUBTLE,
    TEXT: STATUS_NEUTRAL_TEXT,
    TEXT_SUBTLE: STATUS_NEUTRAL_TEXT,
    SOLID_BG: STATUS_NEUTRAL_SOLID,
    SOLID_TEXT: WHITE,
    BORDER: STATUS_NEUTRAL_BORDER,
    bgSubtle: STATUS_NEUTRAL_BG_SUBTLE,
    textSubtle: STATUS_NEUTRAL_TEXT,
    solidBg: STATUS_NEUTRAL_SOLID,
    solidText: WHITE,
    borderColor: STATUS_NEUTRAL_BORDER,
} as const;

const STATUS_PRIMARY = {
    BG_SUBTLE: STATUS_PRIMARY_BG_SUBTLE,
    TEXT: ACCENT_PRIMARY,
    TEXT_SUBTLE: ACCENT_PRIMARY,
    SOLID_BG: ACCENT_PRIMARY,
    SOLID_TEXT: WHITE,
    BORDER: ACCENT_PRIMARY,
    bgSubtle: STATUS_PRIMARY_BG_SUBTLE,
    textSubtle: ACCENT_PRIMARY,
    solidBg: ACCENT_PRIMARY,
    solidText: WHITE,
    borderColor: ACCENT_PRIMARY,
} as const;

export type StatusColorType = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
export type StatusPalette = typeof STATUS_SUCCESS;

const BACKGROUND_TINT_INFO = "#0080a21f";
const BACKGROUND_TINT_SUCCESS = "#16a34a24";
const BACKGROUND_TINT_DANGER = "#ff000024";
const BACKGROUND_TINT_WARNING = "#FF8C001f";
const BACKGROUND_TINT_DISABLED = "#7F7F7F1f";
const BACKGROUND_TINT_ALERT = "#e9de101f";

const TEXT_PRIMARY = BLACK;
const TEXT_SECONDARY = GRAY_600;
const TEXT_TERTIARY = GRAY_650;
const TEXT_CONTRAST = WHITE;

const BORDER_DEFAULT = GRAY_400;
const BORDER_SUBTLE = GRAY_300;
const BORDER_WEAK = GRAY_500;

const ICON_MUTED = GRAY_600;

function clamp01(value: number) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function hexToRgb(hex: string) {
    const normalized = hex.replace("#", "").trim();
    const full = normalized.length === 3
        ? normalized
                .split("")
                .map((c) => `${c}${c}`)
                .join("")
        : normalized;

    const parsed = Number.parseInt(full, 16);
    const r = (parsed >> 16) & 255;
    const g = (parsed >> 8) & 255;
    const b = parsed & 255;
    return { r, g, b };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(colorA: string, colorB: string, colorBWeight: number) {
    const t = clamp01(colorBWeight);
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);

    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bb = Math.round(a.b + (b.b - a.b) * t);

    return rgbToHex({ r, g, b: bb });
}

const GRAPHICS_GRAY_TARGET = GRAY_300;
const GRAPHICS_PRIMARY = ACCENT_SECONDARY;
const GRAPHICS_SECONDARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 1 / 9);
const GRAPHICS_TERTIARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 2 / 9);
const GRAPHICS_QUATERNARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 3 / 9);
const GRAPHICS_QUINARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 4 / 9);
const GRAPHICS_SENARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 5 / 9);
const GRAPHICS_SEPTENARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 6 / 9);
const GRAPHICS_OCTONARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 7 / 9);
const GRAPHICS_NONARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 8 / 9);
const GRAPHICS_DENARY = GRAPHICS_GRAY_TARGET;

const GRAPHICS_DANGER_PRIMARY = RED_DANGER;
const GRAPHICS_DANGER_SECONDARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 1 / 9);
const GRAPHICS_DANGER_TERTIARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 2 / 9);
const GRAPHICS_DANGER_QUATERNARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 3 / 9);
const GRAPHICS_DANGER_QUINARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 4 / 9);
const GRAPHICS_DANGER_SENARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 5 / 9);
const GRAPHICS_DANGER_SEPTENARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 6 / 9);
const GRAPHICS_DANGER_OCTONARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 7 / 9);
const GRAPHICS_DANGER_NONARY = mixHexColors(RED_DANGER, GRAPHICS_GRAY_TARGET, 8 / 9);
const GRAPHICS_DANGER_DENARY = GRAPHICS_GRAY_TARGET;

// Un color por período comparado en el dashboard (hasta 4 a la vez). Validados como paleta
// categórica sobre fondo claro: contraste >= 3:1 y distinguibles entre sí con daltonismo.
const GRAPHICS_PERIODOS = ["#007f9e", "#eb6834", "#6250d6", "#8a5a00"] as const;

export const COLOR = {
    BACKGROUND: {
        PRIMARY: BACKGROUND_PRIMARY,
        SECONDARY: BACKGROUND_SECONDARY,
        SUBTLE: BACKGROUND_SUBTLE,
        INFO_TINT: BACKGROUND_TINT_INFO,
        SUCCESS_TINT: BACKGROUND_TINT_SUCCESS,
        DANGER_TINT: BACKGROUND_TINT_DANGER,
        WARNING_TINT: BACKGROUND_TINT_WARNING,
        DISABLED_TINT: BACKGROUND_TINT_DISABLED,
        ALERT_TINT: BACKGROUND_TINT_ALERT,
    },
    TEXT: {
        PRIMARY: TEXT_PRIMARY,
        SECONDARY: TEXT_SECONDARY,
        TERTIARY: TEXT_TERTIARY,
        CONTRAST: TEXT_CONTRAST,
    },
    BORDER: {
        DEFAULT: BORDER_DEFAULT,
        SUBTLE: BORDER_SUBTLE,
        WEAK: BORDER_WEAK,
    },
    ICON: {
        MUTED: ICON_MUTED,
        DANGER: RED_DANGER,
    },
    BUTTON: {
        PRIMARY: {
            BACKGROUND: ACCENT_PRIMARY,
            TEXT: TEXT_CONTRAST,
        },
    },
    INPUT: {
        PRIMARY: {
            BACKGROUND: WHITE,
            TEXT: TEXT_PRIMARY,
            BORDER: BORDER_DEFAULT,
        },
    },
    ACCENT: {
        PRIMARY: ACCENT_SECONDARY,
        HOVER: ACCENT_HOVER,
    },
    GRAPHICS: {
        PRIMARY: GRAPHICS_PRIMARY,
        SECONDARY: GRAPHICS_SECONDARY,
        TERTIARY: GRAPHICS_TERTIARY,
        QUATERNARY: GRAPHICS_QUATERNARY,
        QUINARY: GRAPHICS_QUINARY,
        SENARY: GRAPHICS_SENARY,
        SEPTENARY: GRAPHICS_SEPTENARY,
        OCTONARY: GRAPHICS_OCTONARY,
        NONARY: GRAPHICS_NONARY,
        DENARY: GRAPHICS_DENARY,
    },
    GRAPHICS_DANGER: {
        PRIMARY: GRAPHICS_DANGER_PRIMARY,
        SECONDARY: GRAPHICS_DANGER_SECONDARY,
        TERTIARY: GRAPHICS_DANGER_TERTIARY,
        QUATERNARY: GRAPHICS_DANGER_QUATERNARY,
        QUINARY: GRAPHICS_DANGER_QUINARY,
        SENARY: GRAPHICS_DANGER_SENARY,
        SEPTENARY: GRAPHICS_DANGER_SEPTENARY,
        OCTONARY: GRAPHICS_DANGER_OCTONARY,
        NONARY: GRAPHICS_DANGER_NONARY,
        DENARY: GRAPHICS_DANGER_DENARY,
    },
    GRAPHICS_PERIODOS,
    SEMANTIC: {
        DANGER: RED_DANGER,
        WARNING : "#FF8C00",
        ALERT: ALERT_YELLOW,
        SUCCESS: "#228B22",
        INFO : ACCENT_PRIMARY,
        DISABLED : GRAY_650,
    },
    STATUS: {
        SUCCESS: STATUS_SUCCESS,
        WARNING: STATUS_WARNING,
        DANGER: STATUS_DANGER,
        INFO: STATUS_INFO,
        NEUTRAL: STATUS_NEUTRAL,
        PRIMARY: STATUS_PRIMARY,
        success: STATUS_SUCCESS,
        warning: STATUS_WARNING,
        danger: STATUS_DANGER,
        info: STATUS_INFO,
        neutral: STATUS_NEUTRAL,
        primary: STATUS_PRIMARY,
    },
} as const;

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const

export const TYPOGRAPHY = {
    dashboard: {
        chartTitle: {
            fontSize: 16,
            fontWeight: 600,
            color: COLOR.TEXT.PRIMARY,
            margin: 0,
            marginBottom: 8,
        }
    }
} as const;
