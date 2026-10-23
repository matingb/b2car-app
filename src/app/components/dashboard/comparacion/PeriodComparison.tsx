"use client";

import React from "react";
import { css } from "@emotion/react";
import { ChevronDown } from "lucide-react";
import DashboardExpandablePanel from "@/app/components/dashboard/DashboardExpandablePanel";
import PeriodComparisonTable from "./PeriodComparisonTable";
import AddPeriodForm from "./AddPeriodForm";
import type { DashboardComparison } from "@/app/hooks/dashboard/useDashboardControls";
import type { ComparisonColumn } from "@/lib/dashboard/cards";
import { COLOR } from "@/theme/theme";

type Props = {
    comparison: DashboardComparison;
    columns: ComparisonColumn[];
};

/** Chevron bajo el gráfico que despliega la tabla de períodos a comparar. */
export default function PeriodComparison({ comparison, columns }: Props) {
    const { rows } = comparison;

    return (
        <div style={styles.wrapper}>
            <button
                type="button"
                css={styles.toggle}
                onClick={comparison.toggleOpen}
                aria-expanded={comparison.open}
                data-testid="comparar-periodos-toggle"
            >
                <span>{rows.length > 1 ? `Comparar períodos (${rows.length})` : "Comparar períodos"}</span>
                <ChevronDown
                    size={16}
                    style={{
                        transform: comparison.open ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                    }}
                />
            </button>

            <DashboardExpandablePanel isOpen={comparison.open}>
                <div style={styles.content}>
                    {rows.length > 0 ? (
                        <PeriodComparisonTable
                            rows={rows}
                            columns={columns}
                            onToggleVisibility={comparison.toggleVisibility}
                            onRemove={comparison.remove}
                            onRetry={comparison.retry}
                            onMove={comparison.move}
                        />
                    ) : (
                        <p style={styles.empty} data-testid="comparacion-vacia">
                            No hay períodos en la tabla: los gráficos muestran {comparison.fallbackLabel}.
                        </p>
                    )}
                    <AddPeriodForm onAdd={comparison.add} />
                </div>
            </DashboardExpandablePanel>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        flexDirection: "column" as const,
        marginTop: 8,
    },
    toggle: css({
        alignSelf: "center",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        border: "none",
        borderRadius: 8,
        background: "transparent",
        color: COLOR.TEXT.SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        "&:hover": {
            background: COLOR.BACKGROUND.SUBTLE,
            color: COLOR.TEXT.PRIMARY,
        },
    }),
    content: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        paddingTop: 12,
        borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
        marginTop: 8,
    },
    empty: {
        margin: 0,
        fontSize: 13,
        color: COLOR.TEXT.SECONDARY,
    },
} as const;
