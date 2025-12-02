"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Divider } from "@mui/material";
import { Mail, Phone, Pencil, FileText, MapPin } from "lucide-react";
import { COLOR } from "@/theme/theme";
import IconButton from "@/app/components/ui/IconButton";

type Props = {
  email?: string;
  telefono?: string;
  cuit?: string;
  onEdit?: () => void;
  style?: React.CSSProperties;
  direccion?: string;
};

export default function ContactInfoCard({ email, telefono, cuit, onEdit, style, direccion }: Props) {
  return (
    <div>
      <div style={styles.header}>
        <h3>Datos de contacto</h3>
        {onEdit && (
          <IconButton
            icon={<Pencil/>}
            size={18}
            onClick={onEdit}
            title="Editar cliente"
            ariaLabel="Editar cliente"
          />
        )}
      </div>
     

      <Card style={{ ...styles.contentPanel, ...style }}>


        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignContent: "center",
            padding: "4px 8px",
          }}
        >
          <IconLabel
            icon={<Mail size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={email ?? "-"}
          />
          <IconLabel
            icon={<Phone size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={telefono ?? "-"}
          />
          {cuit && (
            <IconLabel
              icon={<FileText size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
              label={`CUIT: ${cuit}`}
            />
          )}
          {direccion && (
            <IconLabel
              icon={<MapPin size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
              label={direccion}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "100%",
    height: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 20,
    marginBottom: 8,
    fontWeight: 600,
  },
  iconButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    transition: "background 0.2s",
  },
} as const;

