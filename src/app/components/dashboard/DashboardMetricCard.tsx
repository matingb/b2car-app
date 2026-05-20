"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import { css } from "@emotion/react";
import { ChevronDown } from "lucide-react";

function getNumericMeta(value: number | undefined): { value: number; decimals: number } | null {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value)) return null;
    const decimals = Number.isInteger(value) ? 0 : 2;
    return { value, decimals };
}

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function formatNumberEs(value: number, decimals: number) {
    const safeDecimals = Math.min(Math.max(decimals, 0), 6);
    const fixed = value.toFixed(safeDecimals);
    const [intPart, fracPart] = fixed.split(".");
    const withThousands = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (!safeDecimals) return withThousands;
    return `${withThousands},${fracPart ?? ""}`;
}

type Props = {
    titleText: string;
    value?: number;
    prefix?: string;
    suffix?: string;
    icon?: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    valueColor?: string;
};

export default function DashboardMetricCard({
    titleText,
    value,
    prefix,
    suffix,
    icon,
    isActive,
    onClick,
    valueColor,
}: Props) {
    const parsed = useMemo(() => getNumericMeta(value), [value]);
    const [animatedValue, setAnimatedValue] = useState<number | null>(null);
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!parsed) {
            setAnimatedValue(null);
            return;
        }

        const to = parsed.value;
        const durationMs = 1200;
        const start = performance.now();
        setAnimatedValue(0);

        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / durationMs, 1);
            const current = 0 + (to - 0) * easeOutCubic(t);
            setAnimatedValue(current);
            if (t < 1) rafIdRef.current = requestAnimationFrame(tick);
        };

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [parsed]);

    const displayValue = useMemo(() => {
        if (!parsed) return "—";
        const n = animatedValue ?? parsed.value;
        const formatted = formatNumberEs(n, parsed.decimals);
        let result = prefix ? `${prefix}${formatted}` : formatted;
        if (suffix) result = `${result}${suffix}`;
        return result;
    }, [parsed, animatedValue, prefix, suffix]);

    return (
        <Card onClick={onClick} style={isActive ? styles.cardActive : styles.card}>
            <div css={styles.header}>
                <div css={styles.titleRow}>
                    {icon && <span css={styles.iconWrap}>{icon}</span>}
                    <h3 css={styles.title}>{titleText}</h3>
                </div>
                <ChevronDown
                    size={16}
                    color={COLOR.TEXT.SECONDARY}
                    style={{
                        transition: "transform 0.2s ease",
                        transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
                        flexShrink: 0,
                    }}
                />
            </div>
            <span
                css={styles.value}
                style={{ color: valueColor ?? COLOR.ACCENT.PRIMARY }}
            >
                {displayValue}
            </span>
        </Card>
    );
}

const styles = {
    card: {
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
    },
    cardActive: {
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
        boxShadow: "0 4px 12px rgba(0, 128, 162, 0.15)",
    },
    header: css({
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: 4,
    }),
    titleRow: css({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    }),
    iconWrap: css({
        flex: "0 0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": { width: 20, height: 20, flexShrink: 0 },
    }),
    title: css({
        fontSize: 18,
        fontWeight: 600,
        color: COLOR.TEXT.PRIMARY,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: { fontSize: 16 },
    }),
    value: css({
        fontSize: 28,
        fontWeight: 700,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: { fontSize: 22 },
    }),
};
