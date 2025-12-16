"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import IconButton from "@/app/components/ui/IconButton";
import { Vehiculo } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { Calendar, Gauge, Hash, Pencil, Trash } from "lucide-react";
import { css } from "@emotion/react";

type Props = {
  vehiculo: Vehiculo | null;
  maxKilometraje?: number;
  onDelete?: () => void;
  onEdit: () => void;
  onClick?: () => void;
  showDelete?: boolean | false;
  showEdit?: boolean | false;
  style?: React.CSSProperties;
};

export default function VehiculoInfoCard({
  vehiculo,
  maxKilometraje,
  onDelete,
  onEdit,
  onClick,
  showDelete = false,
  showEdit = false,
  style,
}: Props) {
  const nroInterno = (vehiculo?.nro_interno ?? "").trim();

  return (
    <div style={{ ...styles.container, ...style }}>
      <div style={styles.headerRow}>
        <h3 css={styles.title}>Información del Vehículo</h3>
        <div style={styles.actions}>
          {showDelete && vehiculo && (
            <IconButton
              icon={<Trash />}
              size={18}
              onClick={onDelete}
              title="Editar vehículo"
              ariaLabel="Editar vehículo"
            />
          )}
          {showEdit && (
            <IconButton
              icon={<Pencil />}
              size={18}
              onClick={onEdit}
              title="Editar vehículo"
              ariaLabel="Editar vehículo"
            />
          )}
        </div>
      </div>
      <Card onClick={onClick}>
        <div css={styles.grid}>
          <div>
            <div style={styles.label}>Patente</div>
            <div style={styles.patente}>{vehiculo?.patente}</div>
          </div>
          {nroInterno && (
            <div>
              <div style={styles.label}>N° interno</div>
              <IconLabel
                icon={<Hash size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={nroInterno}
              />
            </div>
          )}
          <div>
            <div style={styles.label}>Marca</div>
            <div style={styles.value}>{vehiculo?.marca}</div>
          </div>
          <div>
            <div style={styles.label}>Modelo</div>
            <div style={styles.value}>{vehiculo?.modelo}</div>
          </div>
          <div>
            <div style={styles.label}>Año</div>
            <IconLabel
              icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={vehiculo?.fecha_patente}
            />
          </div>
          {typeof maxKilometraje === "number" && (
            <div>
              <div style={styles.label}>Kilometraje</div>
              <IconLabel
                icon={<Gauge size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={`${maxKilometraje.toLocaleString()} km`}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

const styles = {
  container: {
    minWidth: 300,
  },
  headerRow: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 18,
    },
  },
  grid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  }),
  label: {
    fontSize: 14,
    color: COLOR.ICON.MUTED,
    marginBottom: 4,
  },
  patente: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.ACCENT.PRIMARY,
  },
  value: {
    fontSize: 18,
    fontWeight: 500,
  },
} as const;
