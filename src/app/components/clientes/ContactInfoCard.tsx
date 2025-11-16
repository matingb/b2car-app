"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Divider } from "@mui/material";
import { Mail, Phone, Pencil } from "lucide-react";
import { COLOR } from "@/theme/theme";

type Props = {
  email?: string;
  telefono?: string;
  onEdit?: () => void;
};

export default function ContactInfoCard({ email, telefono, onEdit }: Props) {
  return (
    <Card style={styles.contentPanel}>
      <div style={styles.header}>
        <h2>Datos de contacto</h2>
        {onEdit && (
          <button
            onClick={onEdit}
            style={styles.iconButton}
            title="Editar cliente"
          >
            <Pencil size={18} color={COLOR.ACCENT.PRIMARY} />
          </button>
        )}
      </div>
      <Divider />

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
      </div>
    </Card>
  );
}

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "50%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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

