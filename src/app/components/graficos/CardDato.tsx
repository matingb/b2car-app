"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Card from "../ui/Card";
import { ExternalLink } from "lucide-react";

type Props = {
    titleText?: string;
    value?: string | number;
    icon?: React.ReactNode;
    onClick?: () => void;
    style?: React.CSSProperties;
};

function parseNumericValue(value: string | number | undefined):
    | { value: number; decimals: number }
    | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        const decimals = value % 1 === 0 ? 0 : 2;
        return { value, decimals };
    }

    const raw = value.trim();
    if (!raw) return null;

    // Keep digits, separators and sign only.
    const cleaned = raw.replace(/[^0-9.,-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") {
        return null;
    }

    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");

    // Decide decimal separator by last occurrence.
    let normalized = cleaned;
    let decimals = 0;

    if (lastDot !== -1 || lastComma !== -1) {
        const decimalSeparator = lastComma > lastDot ? "," : ".";
        const split = cleaned.split(decimalSeparator);

        if (split.length > 1) {
            const fractional = split[split.length - 1] ?? "";
            decimals = Math.min(Math.max(fractional.length, 0), 6);
        }

        // Remove thousands separators: remove the other symbol.
        const thousandSeparator = decimalSeparator === "," ? "." : ",";
        normalized = cleaned.replaceAll(thousandSeparator, "");
        // Normalize decimal separator to dot.
        normalized = normalized.replace(decimalSeparator, ".");
        // If multiple decimals accidentally, keep first.
        const first = normalized.indexOf(".");
        if (first !== -1) {
            normalized =
                normalized.slice(0, first + 1) +
                normalized.slice(first + 1).replace(/\./g, "");
        }
    }

    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;

    return { value: n, decimals };
}

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function formatNumberEs(value: number, decimals: number) {
    const safeDecimals = Math.min(Math.max(decimals, 0), 6);
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);

    // toFixed uses dot as decimal separator; we post-process.
    const fixed = abs.toFixed(safeDecimals);
    const [intPart, fracPart] = fixed.split(".");

    const withThousands = (intPart ?? "0").replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
    );

    if (!safeDecimals) {
        return `${sign}${withThousands}`;
    }

    return `${sign}${withThousands},${fracPart ?? ""}`;
}

export default function CardDato({ titleText, value, onClick, icon, style }: Props) {
    const parsed = useMemo(() => parseNumericValue(value), [value]);
    const [animatedValue, setAnimatedValue] = useState<number | null>(null);
    const lastTargetRef = useRef<number>(0);

    useEffect(() => {
        if (!parsed) {
            setAnimatedValue(null);
            return;
        }

        const from = lastTargetRef.current;
        const to = parsed.value;
        lastTargetRef.current = to;

        // Avoid animating tiny/no-op changes.
        if (from === to) {
            setAnimatedValue(to);
            return;
        }

        const durationMs = 1500; // Tiene que durar 500ms mas que el de los graficos
        const start = performance.now();
        let rafId = 0;

        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / durationMs, 1);
            const eased = easeOutCubic(t);
            const current = from + (to - from) * eased;
            setAnimatedValue(current);
            if (t < 1) {
                rafId = requestAnimationFrame(tick);
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [parsed]);

    const displayValue = useMemo(() => {
        if (!parsed) return value ?? "";

        const n = animatedValue ?? parsed.value;
        return formatNumberEs(n, parsed.decimals);
    }, [value, parsed, animatedValue]);

    return (
        <div style={{ ...styles.mainPanel, ...style }}>
            <Card
                onClick={onClick}
            >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {icon}
                    <h3 css={styles.title}>{titleText}</h3>
                    
                </div>
                <span style={{ fontSize: 28, fontWeight: 700, ...styles.singleLine }}>
                    {displayValue}
                </span>
            </Card>
        </div>
    );
}

const styles = {
    mainPanel: {
        minWidth: '18%',
    },
    title: {
        fontSize: 20,
        fontWeight: 600,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            fontSize: 18,
        },
    },
    singleLine: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: COLOR.ACCENT.PRIMARY,
    }
} as const;