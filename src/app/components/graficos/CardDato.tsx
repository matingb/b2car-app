"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "../ui/Card";
import { css } from "@emotion/react";

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

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
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
    const [animatedValue, setAnimatedValue] = useState<number | null>(null);
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!parsed) {
            setAnimatedValue(null);
            return;
        }

        const from = 0;
        const to = parsed.value;
        const durationMs = 1500; // Tiene que durar 500ms mas que el de los graficos
        const start = performance.now();
        setAnimatedValue(from);

        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / durationMs, 1);
            const eased = easeOutCubic(t);
            const current = from + (to - from) * eased;
            setAnimatedValue(current);
            if (t < 1) {
                rafIdRef.current = requestAnimationFrame(tick);
            }
        };

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        };
    }, [parsed]);

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