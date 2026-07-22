"use client";

import React, { useRef, useEffect, useState } from "react";

type Props = {
    isOpen: boolean;
    children: React.ReactNode;
};

export default function DashboardExpandablePanel({ isOpen, children }: Props) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number>(0);
    const [hasBeenOpen, setHasBeenOpen] = useState(isOpen);
    const [openCount, setOpenCount] = useState(isOpen ? 1 : 0);

    useEffect(() => {
        if (isOpen) {
            setHasBeenOpen(true);
            setOpenCount(c => c + 1);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!contentRef.current || !hasBeenOpen) return;

        const updateHeight = () => {
            if (isOpen) {
                setHeight(contentRef.current?.scrollHeight || 0);
            } else {
                setHeight(0);
            }
        };

        updateHeight();

        const observer = new ResizeObserver(() => {
            if (isOpen) {
                setHeight(contentRef.current?.scrollHeight || 0);
            }
        });

        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [isOpen, children, hasBeenOpen, openCount]);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                height,
            }}
        >
            <div ref={contentRef}>
                <div style={styles.panel}>
                    {hasBeenOpen ? <div key={openCount} style={{ animation: isOpen ? "fadeIn 0.5s ease-out" : "none" }}>{children}</div> : null}
                </div>
            </div>
        </div>
    );
}

const styles = {
    panel: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
} as const;
