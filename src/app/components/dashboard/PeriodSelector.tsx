"use client";

import React from "react";
import Dropdown from "../ui/Dropdown";
import { localCalendarDateStartISO, toISODateLocal } from "@/lib/fechas";

export type PeriodOption = {
    label: string;
    from: string;
    to: string;
};

const MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function buildPeriodOptions(
    count = 12,
    now: Date = new Date(),
    timezone: "local" | "UTC" = "local",
): PeriodOption[] {
    const options: PeriodOption[] = [];
    for (let i = 0; i < count; i++) {
        const d = timezone === "UTC"
            ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
            : new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = timezone === "UTC"
            ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
            : new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const from = timezone === "UTC"
            ? d.toISOString()
            : localCalendarDateStartISO(toISODateLocal(d)) ?? d.toISOString();
        const to = timezone === "UTC"
            ? nextMonth.toISOString()
            : localCalendarDateStartISO(toISODateLocal(nextMonth)) ?? nextMonth.toISOString();
        const year = timezone === "UTC" ? d.getUTCFullYear() : d.getFullYear();
        const month = timezone === "UTC" ? d.getUTCMonth() : d.getMonth();
        const label = `${MONTH_NAMES_ES[month]} ${year}`;
        options.push({ label, from, to });
    }
    return options;
}

type Props = {
    value: PeriodOption;
    onChange: (period: PeriodOption) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
    const now = new Date();
    const localOptions = buildPeriodOptions(12, now, "local");
    const options = localOptions.some((option) => option.from === value.from)
        ? localOptions
        : buildPeriodOptions(12, now, "UTC");

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
        width: "155px",
    },
} as const;
