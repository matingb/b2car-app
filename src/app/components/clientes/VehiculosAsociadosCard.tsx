"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import { Plus, Car } from "lucide-react";
import { Vehiculo } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatPatente } from "@/utils/vehiculos";
import IconButton from "@/app/components/ui/IconButton";

type Props = {
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
};

export default function VehiculosAsociadosCard({ vehiculos, onAddVehiculo }: Props) {
  const router = useRouter();
  const hasVehiculos = Array.isArray(vehiculos) && vehiculos.length > 0;
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.sm}px)`);

    const onChange = () => setIsMobile(mql.matches);
    onChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Safari fallback
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(onChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(onChange);
  }, []);

  return (
    <div>
      <div style={styles.header}>
        <h3>Vehículos asociados</h3>
        <IconButton
          icon={<Plus />}
          size={18}
          onClick={onAddVehiculo}
          title="Editar cliente"
          ariaLabel="Editar cliente"
        />
      </div>
      <Card style={hasVehiculos ? styles.contentPanel : styles.contentPanelEmpty} >
        {hasVehiculos ? (
          <div style={isMobile ? styles.listMobile : styles.grid}>
            {vehiculos.map((vehiculo: Vehiculo) => (
              <Card
                key={vehiculo.id ?? vehiculo.patente ?? Math.random()}
                style={isMobile ? styles.itemRow : styles.itemSquare}
                onClick={() => {
                  router.push(ROUTES.vehiculos + "/" + vehiculo.id);
                }}
                aria-label={`Ver vehículo ${vehiculo.patente ?? "-"}`}
              >
                {isMobile ? (
                  <div style={styles.rowContent}>
                    <Car size={22} color={COLOR.ACCENT.PRIMARY} />
                    <div style={styles.rowText}>
                      <span style={styles.patente}>{formatPatente(vehiculo.patente)}</span>
                      <span style={styles.separator}>|</span>
                      <span style={styles.modelo}>{vehiculo.modelo ?? "-"}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Car size={28} color={COLOR.ACCENT.PRIMARY} />
                    <div style={styles.squarePatente}>{formatPatente(vehiculo.patente)}</div>
                    <div style={styles.squareSubtitle}>
                      {vehiculo.marca ?? "-"} {vehiculo.modelo ?? "-"}
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyText}>No hay vehículos asociados</div>
          </div>
        )}
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
  contentPanelEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  grid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",

  },
  listMobile: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  emptyContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    padding: 12,
    boxSizing: "border-box",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textAlign: "center",
  },
  itemSquare: {
    width: 120,
    height: 128,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    background: "rgba(0,0,0,0.02)",
    cursor: "pointer",
    padding: 8,
    boxSizing: "border-box",
  },
  itemRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    borderRadius: 8,
    cursor: "pointer",
    padding: 12,
    boxSizing: "border-box",
  },
  rowContent: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minWidth: 0,
  },
  rowText: {
    display: "flex",
    alignItems: "baseline",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  patente: {
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  },
  separator: {
    margin: "0 8px",
    color: COLOR.TEXT.SECONDARY,
    flexShrink: 0,
  },
  modelo: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  squarePatente: {
    fontWeight: 700,
    marginTop: 8,
  },
  squareSubtitle: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 13,
  },
} as const;

