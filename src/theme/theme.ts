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

const BACKGROUND_PRIMARY = GRAY_200;
const BACKGROUND_SECONDARY = WHITE;
const BACKGROUND_SUBTLE = GRAY_100;

const TEXT_PRIMARY = BLACK;
const TEXT_SECONDARY = GRAY_600;
const TEXT_TERTIARY = GRAY_650;
const TEXT_CONTRAST = WHITE;

const BORDER_DEFAULT = GRAY_400;
const BORDER_SUBTLE = GRAY_300;
const BORDER_WEAK = GRAY_500;

const ICON_MUTED = GRAY_600;

export const COLOR = {
    BACKGROUND: {
        PRIMARY: BACKGROUND_PRIMARY,
        SECONDARY: BACKGROUND_SECONDARY,
        SUBTLE: BACKGROUND_SUBTLE,
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
} as const;

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
} as const