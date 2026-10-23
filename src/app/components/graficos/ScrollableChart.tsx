"use client";

import React, { useEffect, useRef } from "react";
import type { Granularity } from "@/lib/dashboard/aggregation";

/** Ancho mínimo por barra (o grupo de barras) antes de pasar a scroll horizontal. */
const MIN_CATEGORY_WIDTH: Record<Granularity, number> = { day: 18, week: 44, month: 56 };

/** Espacio del eje Y y los márgenes del gráfico. */
const AXIS_WIDTH = 80;

type Props = {
    categories: number;
    granularity: Granularity;
    children: React.ReactNode;
};

/**
 * Las barras se comprimen hasta un ancho mínimo; si el período no entra, el gráfico scrollea en
 * horizontal y arranca mostrando el final (lo más reciente).
 */
export default function ScrollableChart({ categories, granularity, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const minWidth = categories * MIN_CATEGORY_WIDTH[granularity] + AXIS_WIDTH;

    useEffect(() => {
        const el = ref.current;
        if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
    }, [minWidth]);

    return (
        <div ref={ref} style={styles.scroller} data-testid="scrollable-chart">
            <div style={{ ...styles.content, minWidth }}>{children}</div>
        </div>
    );
}

const styles = {
    scroller: {
        width: "100%",
        overflowX: "auto" as const,
        overflowY: "hidden" as const,
    },
    content: {
        width: "100%",
    },
} as const;
