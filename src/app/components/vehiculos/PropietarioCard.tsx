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
  onClick?: () => void; // navegar a detalle
  onReassign?: () => void; // abrir modal de reasignación
  style?: React.CSSProperties;
};

export default function PropietarioCard({ cliente, onClick, onReassign, style }: Props) {

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Propietario</h3>
        {onReassign && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReassign(); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Reasignar propietario"
            title="Reasignar propietario"
          >
            {/* Simple lápiz reutilizando estilo de edición */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLOR.ACCENT.PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
      </div>
      <div
      style={{
        ...style,
        minWidth: 300,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <Card
        style={{
          height: '100%',
        }}
        enableHover={true}
      >
        
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 0,
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
            <IconLabel
                icon={<Phone size={16} color={COLOR.ACCENT.PRIMARY} />}
                label={cliente.telefono || "-"}
              />
            <IconLabel
                icon={<Mail size={16} color={COLOR.ACCENT.PRIMARY} />}
                label={cliente.email || "-"}
              />
            <IconLabel
                icon={<MapPin size={16} color={COLOR.ACCENT.PRIMARY} />}
                label={cliente.direccion || "-"}
              />
          </div>
        </div>
      </Card>
    </div>
  </div>
  );
}

