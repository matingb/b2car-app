"use client";

import React, { ReactNode } from "react";
import Avatar from "@/app/components/ui/Avatar";
import { COLOR } from "@/theme/theme";

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
        marginBottom: 14,
        marginTop: 12,
      }}
    >
      <Avatar nombre={nombre} size={60} />
      <div>
        <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          {nombre}
        </h1>
        {subtitle && (
          <div style={{ color: COLOR.TEXT.SECONDARY, fontSize: 14, display: "flex", gap: 8 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

