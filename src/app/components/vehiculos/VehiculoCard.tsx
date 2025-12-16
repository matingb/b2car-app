"use client";

import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Vehiculo } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { User } from "lucide-react";

interface VehiculoCardProps {
  vehiculo: Vehiculo;
  onClick: () => void;
}

export default function VehiculoCard({ vehiculo, onClick }: VehiculoCardProps) {
  const title = `${vehiculo.marca} ${vehiculo.modelo}`;

  return (
    <Card
      onClick={onClick}
      style={{ padding: "10px 12px" }}
    >
      <div css={styles.cardContent}>
        <div css={styles.patenteSection}>
          <div css={styles.patenteLabel}>PATENTE</div>
          <div style={styles.patenteValue}><h3>{vehiculo.patente}</h3></div>
        </div>

        <div style={styles.divider} />

        <div style={styles.infoSection}>
          <div style={styles.headerRow}>
            <h2 style={styles.vehicleTitle}>
              {title.trim() != "" ? title : "-"}
              {vehiculo.fecha_patente && (
                <span css={styles.yearBadge}>({vehiculo.fecha_patente})</span>
              )}
            </h2>
          </div>

          <div css={styles.detailsRow}>
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
  cardContent: css({
    display: "flex",
    alignItems: "stretch",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gap: 16,
      alignItems: "center",
      justifyContent: "start",
    },
  }),
  patenteSection: css({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "120px",
    padding: "8px 12px",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "0",
      width: "120px",
    },
  }),
  patenteLabel: css({
    fontSize: 10,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    letterSpacing: "0.5px",
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
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
  yearBadge: css({
    fontSize: 16,
    fontWeight: 400,
    color: COLOR.TEXT.SECONDARY,
    marginLeft: 6,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  detailsRow: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
} as const;

