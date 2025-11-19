"use client";

import { useState } from "react";
import { COLOR } from "@/theme/theme";

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  enableHover?: boolean;
}

export default function Card({ children, onClick, style, enableHover = false }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const hoverStyles = enableHover && isHovered ? {
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`,
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0, 128, 162, 0.15)",
  } : enableHover ? {
    border: `2px solid ${COLOR.BORDER.SUBTLE}`,
  } : {};

  const containerStyles = {
    ...styles.container,
    ...(enableHover && { transition: "all 0.2s ease-in-out" }),
    ...hoverStyles,
    ...style,
  };

  return (
    <div
      style={containerStyles}
      onClick={onClick}
      onMouseEnter={() => enableHover && setIsHovered(true)}
      onMouseLeave={() => enableHover && setIsHovered(false)}
    >
      {children}
    </div>
  );
}

const styles = {
  container: {
    padding: "12px 16px",
    border: "1px solid " + COLOR.BORDER.SUBTLE,
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
};
