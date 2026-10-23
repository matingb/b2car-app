"use client";

import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Plus } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Dropdown from "@/app/components/ui/Dropdown";
import type { AddPeriodResult } from "@/app/hooks/dashboard/useDashboardControls";
import { RELATIVE_PERIOD_LABELS, type ComparisonPeriodDef } from "@/lib/dashboard/comparison";
import { buildPeriodOptions, monthOfPeriod } from "@/lib/dashboard/periods";
import { BREAKPOINTS, COLOR } from "@/theme/theme";

type Kind = ComparisonPeriodDef["kind"];

const KIND_OPTIONS: Array<{ value: Kind; label: string }> = [
    { value: "mes-dashboard", label: RELATIVE_PERIOD_LABELS["mes-dashboard"] },
    { value: "mes-anterior", label: RELATIVE_PERIOD_LABELS["mes-anterior"] },
    { value: "anio-anterior", label: RELATIVE_PERIOD_LABELS["anio-anterior"] },
    { value: "mes", label: "Un mes" },
    { value: "rango", label: "Rango de fechas" },
];

/** Meses que se ofrecen para comparar (3 años hacia atrás). */
const MONTH_OPTIONS_COUNT = 36;

type Props = {
    onAdd: (def: ComparisonPeriodDef) => AddPeriodResult;
};

export default function AddPeriodForm({ onAdd }: Props) {
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<Kind>("mes-anterior");
    const [month, setMonth] = useState("");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [error, setError] = useState<string | null>(null);

    const monthOptions = useMemo(
        () =>
            buildPeriodOptions(MONTH_OPTIONS_COUNT).map((option) => {
                const { year, month: m } = monthOfPeriod(option);
                return { value: `${year}-${m}`, label: option.label };
            }),
        [],
    );

    const reset = () => {
        setOpen(false);
        setKind("mes-anterior");
        setMonth("");
        setDesde("");
        setHasta("");
        setError(null);
    };

    const buildDef = (): ComparisonPeriodDef | string => {
        if (kind === "mes") {
            const [year, m] = month.split("-").map(Number);
            if (!month || !Number.isInteger(year) || !Number.isInteger(m)) return "Elegí un mes";
            return { kind: "mes", year, month: m };
        }
        if (kind === "rango") {
            if (!desde || !hasta) return "Completá las dos fechas";
            return { kind: "rango", desde, hasta };
        }
        return { kind };
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const def = buildDef();
        if (typeof def === "string") {
            setError(def);
            return;
        }
        const result = onAdd(def);
        if (result.ok) reset();
        else setError(result.error);
    };

    if (!open) {
        return (
            <button type="button" css={styles.addLink} onClick={() => setOpen(true)} data-testid="agregar-periodo">
                <Plus size={14} />
                Agregar período
            </button>
        );
    }

    return (
        <form css={styles.form} onSubmit={handleSubmit} data-testid="agregar-periodo-form">
            <div style={styles.field}>
                <label style={styles.label}>Período</label>
                <Dropdown
                    style={styles.dropdown}
                    options={KIND_OPTIONS}
                    value={kind}
                    onChange={(value) => {
                        setKind(value as Kind);
                        setError(null);
                    }}
                    ariaLabel="Tipo de período"
                />
            </div>

            {kind === "mes" && (
                <div style={styles.field}>
                    <label style={styles.label}>Mes</label>
                    <Dropdown
                        style={styles.dropdown}
                        options={monthOptions}
                        value={month}
                        onChange={(value) => {
                            setMonth(value);
                            setError(null);
                        }}
                        placeholder="Elegí un mes"
                        ariaLabel="Mes a comparar"
                    />
                </div>
            )}

            {kind === "rango" && (
                <>
                    <div style={styles.field}>
                        <label style={styles.label} htmlFor="comparar-desde">Desde</label>
                        <input
                            id="comparar-desde"
                            type="date"
                            style={styles.input}
                            value={desde}
                            max={hasta || undefined}
                            onChange={(e) => {
                                setDesde(e.target.value);
                                setError(null);
                            }}
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label} htmlFor="comparar-hasta">Hasta</label>
                        <input
                            id="comparar-hasta"
                            type="date"
                            style={styles.input}
                            value={hasta}
                            min={desde || undefined}
                            onChange={(e) => {
                                setHasta(e.target.value);
                                setError(null);
                            }}
                        />
                    </div>
                </>
            )}

            <div style={styles.actions}>
                <Button type="submit" text="Agregar" hideTextOnMobile={false} style={styles.button} />
                <Button type="button" text="Cancelar" outline hideTextOnMobile={false} style={styles.button} onClick={reset} />
            </div>

            {error && (
                <div role="alert" style={styles.error}>
                    {error}
                </div>
            )}
        </form>
    );
}

const styles = {
    addLink: css({
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 6px",
        border: "none",
        borderRadius: 6,
        background: "transparent",
        color: COLOR.ACCENT.PRIMARY,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        "&:hover": {
            background: COLOR.BACKGROUND.INFO_TINT,
        },
    }),
    form: css({
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 12,
        padding: 12,
        borderRadius: 8,
        background: COLOR.BACKGROUND.SUBTLE,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            flexDirection: "column",
            alignItems: "stretch",
        },
    }),
    field: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 4,
    },
    label: {
        fontSize: 12,
        color: COLOR.TEXT.SECONDARY,
    },
    dropdown: {
        position: "relative" as const,
        height: "35px",
        width: "210px",
    },
    input: {
        height: 35,
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.INPUT.PRIMARY.BACKGROUND,
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box" as const,
    },
    actions: {
        display: "flex",
        gap: 8,
    },
    button: {
        minWidth: 0,
        height: 35,
        fontSize: 13,
        padding: "6px 14px",
    },
    error: {
        width: "100%",
        fontSize: 12,
        color: COLOR.SEMANTIC.DANGER,
    },
} as const;
