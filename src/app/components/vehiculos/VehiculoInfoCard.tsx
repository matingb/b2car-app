"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Vehiculo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { Calendar, Gauge, Pencil } from "lucide-react";

type Props = {
  vehiculo: Vehiculo;
  maxKilometraje?: number;
  onEdit: () => void;
};

export default function VehiculoInfoCard({ vehiculo, maxKilometraje, onEdit }: Props) {
  return (
    <Card style={{ flex: 1, minWidth: 300 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Información del Vehículo
        </h3>
        <button
          onClick={onEdit}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Editar vehículo"
        >
          <Pencil size={18} color={COLOR.ACCENT.PRIMARY} />
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              color: COLOR.ICON.MUTED,
              marginBottom: 4,
            }}
          >
            Patente
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: COLOR.ACCENT.PRIMARY,
            }}
          >
            {vehiculo.patente}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              color: COLOR.ICON.MUTED,
              marginBottom: 4,
            }}
          >
            Marca
          </div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {vehiculo.marca}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              color: COLOR.ICON.MUTED,
              marginBottom: 4,
            }}
          >
            Modelo
          </div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {vehiculo.modelo}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              color: COLOR.ICON.MUTED,
              marginBottom: 4,
            }}
          >
            Año
          </div>
          <IconLabel
            icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
            label={vehiculo.fecha_patente}
          />
        </div>
        {typeof maxKilometraje === "number" && (
          <div>
            <div
              style={{
                fontSize: 14,
                color: COLOR.ICON.MUTED,
                marginBottom: 4,
              }}
            >
              Kilometraje
            </div>
            <IconLabel
              icon={<Gauge size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={`${maxKilometraje.toLocaleString()} km`}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

