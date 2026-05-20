"use client";

import React, { useRef, useEffect, useState } from "react";
import { COLOR } from "@/theme/theme";

type Props = {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
};

export default function DashboardExpandablePanel({ isOpen, title, children }: Props) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number>(0);

    useEffect(() => {
        if (!contentRef.current) return;
        if (isOpen) {
            setHeight(contentRef.current.scrollHeight);
        } else {
            setHeight(0);
        }
    }, [isOpen, children]);

    return (
        <div
            style={{
                overflow: "hidden",
                transition: "height 0.3s ease",
                height,
            }}
        >
            <div ref={contentRef}>
                <div style={styles.panel}>
                    <h3 style={styles.title}>{title}</h3>
                    {children}
                </div>
            </div>
        </div>
    );
}

const styles = {
    panel: {
        border: `2px solid ${COLOR.BORDER.DEFAULT}`,
        borderRadius: 8,
        padding: "16px",
        background: COLOR.BACKGROUND.SUBTLE,
        boxShadow: "0 4px 12px rgba(0, 128, 162, 0.08)",
    },
    title: {
        fontSize: 16,
        fontWeight: 600,
        color: COLOR.TEXT.SECONDARY,
        marginBottom: 12,
    },
} as const;
