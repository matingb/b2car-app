"use client";

import { useState } from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Vehiculo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { User, Eye } from "lucide-react";

interface VehiculoCardProps {
  vehiculo: Vehiculo;
  onClick: () => void;
}

export default function VehiculoCard({ vehiculo, onClick }: VehiculoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      onClick={onClick}
      style={{
        cursor: "pointer",
        border: `2px solid ${isHovered ? COLOR.ACCENT.PRIMARY : COLOR.BORDER.SUBTLE}`,
        transition: "all 0.2s ease-in-out",
        transform: isHovered ? "translateY(-2px)" : "none",
        boxShadow: isHovered
          ? "0 4px 12px rgba(0, 128, 162, 0.15)"
          : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={styles.cardContent}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={styles.patenteSection}>
          <div style={styles.patenteLabel}>PATENTE</div>
          <div style={styles.patenteValue}>{vehiculo.patente}</div>
        </div>

        <div style={styles.divider} />

        <div style={styles.infoSection}>
          <div style={styles.headerRow}>
            <h2 style={styles.vehicleTitle}>
              {vehiculo.marca} {vehiculo.modelo}
              {vehiculo.fecha_patente && (
                <span style={styles.yearBadge}>({vehiculo.fecha_patente})</span>
              )}
            </h2>
            <Eye size={20} color={COLOR.TEXT.SECONDARY} style={{ flexShrink: 0 }} />
          </div>

          <div style={styles.detailsRow}>
            <IconLabel
              icon={<User size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={vehiculo.nombre_cliente}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  cardContent: {
    display: "flex",
    alignItems: "stretch",
    gap: 16,
  },
  patenteSection: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
    padding: "8px 12px",
  },
  patenteLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    letterSpacing: "0.5px",
    marginBottom: 4,
  },
  patenteValue: {
    fontSize: 22,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    letterSpacing: "1px",
  },
  divider: {
    width: 1,
    backgroundColor: COLOR.BORDER.SUBTLE,
    alignSelf: "stretch",
  },
  infoSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
  },
  yearBadge: {
    fontSize: 16,
    fontWeight: 400,
    color: COLOR.TEXT.SECONDARY,
    marginLeft: 6,
  },
  detailsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
  },
} as const;

