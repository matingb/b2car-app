"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import Avatar from "@/app/components/ui/Avatar";
import { Cliente } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { Phone, Mail, MapPin } from "lucide-react";

type Props = {
  cliente: Cliente;
  onClick?: () => void;
};

export default function PropietarioCard({ cliente, onClick }: Props) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 150,
        width: 'fit-content',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
        transform: isHovered && onClick ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onClick={onClick}
      onMouseEnter={() => onClick && setIsHovered(true)}
      onMouseLeave={() => onClick && setIsHovered(false)}
    >
      <Card 
        style={{ 
          height: '100%',
          transition: 'box-shadow 0.2s',
          boxShadow: isHovered && onClick ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
        }}
      >
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
        Propietario
      </h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          backgroundColor: "#f8f9fa",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar nombre={cliente.nombre} size={64} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {cliente.nombre}
            </div>
            <div
              style={{
                fontSize: 14,
                color: COLOR.ICON.MUTED,
                backgroundColor: "#e9ecef",
                padding: "2px 8px",
                borderRadius: 4,
                display: "inline-block",
              }}
            >
              {cliente.tipo_cliente === "particular"
                ? "Particular"
                : "Empresa"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cliente.telefono && (
            <IconLabel
              icon={<Phone size={16} color={COLOR.ACCENT.PRIMARY} />}
              label={cliente.telefono}
            />
          )}
          {cliente.email && (
            <IconLabel
              icon={<Mail size={16} color={COLOR.ACCENT.PRIMARY} />}
              label={cliente.email}
            />
          )}
          {cliente.direccion && (
            <IconLabel
              icon={<MapPin size={16} color={COLOR.ACCENT.PRIMARY} />}
              label={cliente.direccion}
            />
          )}
        </div>
      </div>
    </Card>
    </div>
  );
}

