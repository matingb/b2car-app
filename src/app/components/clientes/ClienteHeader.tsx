"use client";

import React, { ReactNode } from "react";
import Avatar from "@/app/components/ui/Avatar";

type Props = {
  nombre: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
};

export default function ClienteHeader({
  nombre,
  icon,
  subtitle,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 16,
      }}
    >
      <Avatar nombre={nombre} size={60} />
      <div>
        <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          {nombre}
        </h1>
        {subtitle && (
          <div style={{ color: "#666", fontSize: 13, display: "flex", gap: 8 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

