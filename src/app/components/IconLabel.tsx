import React from "react";

type IconLabelProps = {
    icon: React.ReactNode;
    label?: React.ReactNode;
    gap?: number;
    className?: string;
    style?: React.CSSProperties;
};

export default function IconLabel({
    icon,
    label = "-",
    gap = 8,
    className,
    style,
}: IconLabelProps) {
    return (
        <div className={className} style={{ display: "flex", alignItems: "center", gap, ...style }}>
            {icon}
            <span>{label}</span>
        </div>
    );
}