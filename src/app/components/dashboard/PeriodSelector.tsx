"use client";

import React from "react";
import Dropdown from "../ui/Dropdown";
import { buildPeriodOptions, type PeriodOption } from "@/lib/dashboard/periods";

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
