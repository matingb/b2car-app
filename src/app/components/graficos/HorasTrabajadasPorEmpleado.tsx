"use client";

import React from "react";
import type { DashboardHorasTrabajadasPorEmpleado } from "@/lib/dashboard/types";
import { formatNumberAr } from "@/lib/format";
import { getStyles } from "./DesglosePieChart.styles";
import DesglosePieChart, { type DesgloseItem } from "./DesglosePieChart";

function formatHoras(value: number) {
    return `${formatNumberAr(value, { maxDecimals: 2, minDecimals: 0 })} h`;
}

function formatPorcentaje(value: number) {
    return `${formatNumberAr(value, { maxDecimals: 1, minDecimals: 1 })}%`;
}

export function buildHorasTrabajadasChartItems(
    data: DashboardHorasTrabajadasPorEmpleado
): { items: DesgloseItem[]; totalCentesimas: number } {
    const totalCentesimas = Math.round(data.totalHoras * 100);
    const empleados = data.empleados.map((empleado) => {
        const horasCentesimas = Math.round(empleado.horasTrabajadas * 100);
        return {
            horasCentesimas,
            identityKey: empleado.empleadoId ? `empleado_${empleado.empleadoId}` : "sin_empleado",
            label: empleado.empleadoId ? empleado.label : "Sin empleado",
        };
    });

    const sumaEmpleadosCentesimas = empleados.reduce((sum, empleado) => sum + empleado.horasCentesimas, 0);
    if (sumaEmpleadosCentesimas !== totalCentesimas) {
        throw new Error("La suma de horas por empleado no coincide con el total del dashboard");
    }

    return {
        items: empleados.map(({ horasCentesimas, ...empleado }) => ({
            ...empleado,
            cantidad: 0,
            monto: horasCentesimas / 100,
        })),
        totalCentesimas,
    };
}

type Props = {
    data?: DashboardHorasTrabajadasPorEmpleado;
};

export default function HorasTrabajadasPorEmpleado({ data }: Props) {
    if (!data) return null;

    const { items, totalCentesimas } = buildHorasTrabajadasChartItems(data);
    if (totalCentesimas === 0) {
        return (
            <div style={getStyles(false).emptyState} role="status">
                No hay horas trabajadas registradas en este período
            </div>
        );
    }

    return (
        <DesglosePieChart
            id="horas-trabajadas-empleado"
            items={items}
            montoLabel="Horas trabajadas"
            showCountInTooltip={false}
            percentageDecimals={1}
            valueFormatter={formatHoras}
            percentageFormatter={formatPorcentaje}
            percentageTotal={totalCentesimas / 100}
            centerTotal={data.totalHoras}
            centerLabel="Horas trabajadas"
            barScale="percentageOfTotal"
            adaptivePaddingAngle
            allowTooltipEscape
            wrapLabels
            showListOnMobileInitially
            maxListHeight={360}
            listAccessibleLabel="Horas trabajadas por empleado"
            sortLabelOnTies
        />
    );
}
