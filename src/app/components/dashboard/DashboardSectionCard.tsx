"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
    title?: React.ReactNode;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
};

export default function DashboardSectionCard({ title, headerAction, children }: Props) {
    return (
        <div style={styles.card}>
            {(title || headerAction) && (
                <div style={styles.header}>
                    {title ? (typeof title === "string" ? <h4 style={styles.title}>{title}</h4> : title) : <div />}
                    {headerAction}
                </div>
            )}
            {children}
        </div>
    );
}

const styles = {
    card: {
        background: COLOR.BACKGROUND.SECONDARY,
        borderRadius: 8,
        padding: "16px",
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        display: "flex",
        flexDirection: "column" as const,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: 600,
        color: COLOR.TEXT.PRIMARY,
        margin: 0,
    },
};
