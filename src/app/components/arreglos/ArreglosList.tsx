"use client";

import React from "react";
import { Arreglo } from "@/model/types";
import ArregloItem from "./ArregloItem";

type Props = {
  arreglos: Arreglo[];
  onItemClick?: (arreglo: Arreglo) => void;
  showObservaciones?: boolean;
  mostrarObservaciones?: boolean;
};

export default function ArreglosList({
  arreglos,
  onItemClick,
  showObservaciones,
  mostrarObservaciones,
}: Props) {
  const shouldShowObs = showObservaciones ?? mostrarObservaciones;

  return (
    <>
      {arreglos.length === 0 ? (
        <div style={{ color: "rgba(0,0,0,0.7)" }}>
          Este vehículo no tiene arreglos registrados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {arreglos.map((arreglo) => (
            <ArregloItem
              key={arreglo.id}
              arreglo={arreglo}
              onClick={onItemClick}
              showObservaciones={shouldShowObs}
            />
          ))}
        </div>
      )}
    </>
  );
}
