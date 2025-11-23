"use client";

import { useState } from "react";
import { COLOR } from "@/theme/theme";

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Card({ children, onClick, style }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isClickable = onClick !== undefined;

  const hoverStyles = {
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0, 128, 162, 0.15)",
    cursor: "pointer",
  }

  const containerStyles = {
    ...styles.container,
    ...(isClickable && { transition: "all 0.2s ease-in-out" }),
    ...(isHovered && hoverStyles),
    ...style,
  };

  return (
    <div
      style={containerStyles}
      onClick={onClick}
      onMouseEnter={() => isClickable && setIsHovered(true)}
      onMouseLeave={() => isClickable && setIsHovered(false)}
    >
      {children}
    </div>
  );
}

const styles = {
  container: {
    border: `2px solid ${COLOR.BORDER.SUBTLE}`,
    padding: "12px 16px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
};
