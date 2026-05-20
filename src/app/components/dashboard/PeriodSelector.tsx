"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";

export type PeriodOption = {
    label: string;
    from: string;
    to: string;
};

const MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function buildPeriodOptions(count = 6): PeriodOption[] {
    const options: PeriodOption[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const from = d.toISOString();
        const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
        const label = `${MONTH_NAMES_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        options.push({ label, from, to });
    }
    return options;
}

function buildRangeOptions(): PeriodOption[] {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return [2, 3, 6, 12].map((n) => ({
        label: `Últimos ${n} meses`,
        from: new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - n + 1, 1)).toISOString(),
        to: nextMonthStart.toISOString(),
    }));
}

type Props = {
    value: PeriodOption;
    onChange: (period: PeriodOption) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
    const { monthOptions, rangeOptions, allOptions } = useMemo(() => {
        const monthOptions = buildPeriodOptions(12);
        const rangeOptions = buildRangeOptions();
        return { monthOptions, rangeOptions, allOptions: [...rangeOptions, ...monthOptions] };
    }, []);

    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const selected = allOptions.find((o) => o.from === e.target.value);
        if (selected) onChange(selected);
    }

    return (
        <div style={styles.wrapper}>
            <label style={styles.label} htmlFor="period-select">
                Período
            </label>
            <select
                id="period-select"
                value={value.from}
                onChange={handleChange}
                style={styles.select}
            >
                <optgroup label="Rangos">
                    {rangeOptions.map((opt) => (
                        <option key={opt.from} value={opt.from}>
                            {opt.label}
                        </option>
                    ))}
                </optgroup>
                <optgroup label="Mes específico">
                    {monthOptions.map((opt) => (
                        <option key={opt.from} value={opt.from}>
                            {opt.label}
                        </option>
                    ))}
                </optgroup>
            </select>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: 500,
        color: COLOR.TEXT.SECONDARY,
        whiteSpace: "nowrap" as const,
    },
    select: {
        fontSize: 14,
        fontWeight: 500,
        color: COLOR.TEXT.PRIMARY,
        background: COLOR.BACKGROUND.SECONDARY,
        border: `1.5px solid ${COLOR.BORDER.DEFAULT}`,
        borderRadius: 6,
        padding: "5px 10px",
        cursor: "pointer",
        outline: "none",
        appearance: "auto" as const,
    },
} as const;
