"use client";

import React, { useMemo } from "react";
import Dropdown from "../ui/Dropdown";

export type PeriodOption = {
    label: string;
    from: string;
    to: string;
};

const MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function buildPeriodOptions(count = 12): PeriodOption[] {
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

type Props = {
    value: PeriodOption;
    onChange: (period: PeriodOption) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
    const options = useMemo(() => buildPeriodOptions(12), []);

    return (
        <Dropdown
            style={styles.dropdown}
            options={options.map((o) => ({ value: o.from, label: o.label }))}
            value={value.from}
            onChange={(f) => onChange(options.find((o) => o.from === f) ?? value)}
        />
    );
}

const styles = {
    dropdown: {
        position: "relative" as const,
        height: "35px",
        width: "150px",
    },
} as const;
