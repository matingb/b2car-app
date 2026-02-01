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

const BACKGROUND_PRIMARY = GRAY_200;
const BACKGROUND_SECONDARY = WHITE;
const BACKGROUND_SUBTLE = GRAY_100;

const BACKGROUND_TINT_INFO = "#0080a21f";
const BACKGROUND_TINT_SUCCESS = "#16a34a24";
const BACKGROUND_TINT_DANGER = "#ff000024";

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
const GRAPHICS_SECONDARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 1 / 6);
const GRAPHICS_TERTIARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 2 / 6);
const GRAPHICS_QUATERNARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 3 / 6);
const GRAPHICS_QUINARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 4 / 6);
const GRAPHICS_SENARY = mixHexColors(GRAPHICS_PRIMARY, GRAPHICS_GRAY_TARGET, 5 / 6);
const GRAPHICS_SEPTENARY = GRAPHICS_GRAY_TARGET;

export const COLOR = {
    BACKGROUND: {
        PRIMARY: BACKGROUND_PRIMARY,
        SECONDARY: BACKGROUND_SECONDARY,
        SUBTLE: BACKGROUND_SUBTLE,
        INFO_TINT: BACKGROUND_TINT_INFO,
        SUCCESS_TINT: BACKGROUND_TINT_SUCCESS,
        DANGER_TINT: BACKGROUND_TINT_DANGER,
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
    },
    SEMANTIC: {
        DANGER: RED_DANGER,
        WARNING : "#FF8C00",
        SUCCESS: "#228B22",
        INFO : ACCENT_PRIMARY,
        DISABLED : GRAY_650,
    }
} as const;

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const