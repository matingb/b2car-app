"use client";

import React, { useMemo } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "../ui/Card";
import { css } from "@emotion/react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

type Props = {
    titleText?: string;
    value?: number;
    prefix?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    style?: React.CSSProperties;
};

function getNumericMeta(value: number | undefined): { value: number; decimals: number } | null {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value)) return null;
    if (value < 0) return null;
    const decimals = Number.isInteger(value) ? 0 : 2;
    return { value, decimals };
}

function formatNumberEs(value: number, decimals: number) {
    const safeDecimals = Math.min(Math.max(decimals, 0), 6);
    // toFixed usa "." como separador decimal; luego convertimos a formato es-ES.
    const fixed = value.toFixed(safeDecimals);
    const [intPart, fracPart] = fixed.split(".");

    const withThousands = (intPart ?? "0").replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
    );

    if (!safeDecimals) return withThousands;
    return `${withThousands},${fracPart ?? ""}`;
}

export default function CardDato({
    titleText,
    value,
    prefix,
    onClick,
    icon,
    style = {color: COLOR.ACCENT.PRIMARY},
}: Props) {
    const parsed = useMemo(() => getNumericMeta(value), [value]);
    const animatedValue = useAnimatedNumber(parsed?.value);

    const displayValue = useMemo(() => {
        if (!parsed) return "";

        const n = animatedValue ?? parsed.value;
        const formatted = formatNumberEs(n, parsed.decimals);
        return prefix ? `${prefix}${formatted}` : formatted;
    }, [parsed, animatedValue, prefix]);

    return (
        <div css={styles.mainPanel} style={style}>
            <Card
                onClick={onClick}
                style={styles.card}
            >
                <div css={styles.titleContainer}>
                    {icon ? <span css={styles.iconWrap}>{icon}</span> : null}
                    <h3 css={styles.title}>{titleText}</h3>

                </div>
                <span
                    data-testid="card-dato-value"
                    style={{ fontSize: 28, fontWeight: 700, ...styles.singleLine }}
                >
                    {displayValue}
                </span>
            </Card>
        </div>
    );
}

const styles = {
    mainPanel: css({
        width: "100%",
        height: "100%",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "100%",
        },
    }),
    card: {
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
    },
    iconWrap: css({
        flex: "0 0 22px",
        width: 22,
        height: 22,
        minWidth: 22,
        minHeight: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": {
            width: 22,
            height: 22,
            flexShrink: 0,
        },
    }),
    title: {
        fontSize: 20,
        fontWeight: 600,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            fontSize: 18,
        },
        color: COLOR.TEXT.PRIMARY,
    },
    singleLine: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    titleContainer: css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            marginBottom: 0,
        },
    })
} as const;
