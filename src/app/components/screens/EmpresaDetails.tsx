"use client";

import React, { useMemo, useState } from "react";
import Avatar from "@/app/components/ui/Avatar";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Divider } from "@mui/material";
import { Mail, Phone, Building2, MapPin } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { Vehiculo } from "@/model/types";
import Button from "../ui/Button";
import CreateVehiculoModal from "../vehiculos/CreateVehiculoModal";

// Diseño adaptado para empresas
// Muestra nombre de la empresa y datos de contacto; lista de vehículos igual que particulares

type Props = {
  empresa: {
    id?: number;
    nombre?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
  } | null;
  vehiculos: Vehiculo[];
};

export default function EmpresaDetails({ empresa, vehiculos }: Props) {
  const [openVehiculo, setOpenVehiculo] = useState(false);
  const clienteId = useMemo(() => empresa?.id ?? undefined, [empresa]);
  const [vehiculosLocal, setVehiculosLocal] = useState<Vehiculo[]>(vehiculos ?? []);
  React.useEffect(() => {
    setVehiculosLocal(vehiculos ?? []);
  }, [vehiculos]);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Avatar nombre={empresa?.nombre ?? ""} size={60} />
        <div>
          <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={22} color={COLOR.ACCENT.PRIMARY} />
            {empresa?.nombre ?? "-"}
          </h1>
          <div style={{ color: "#666", fontSize: 13, display: "flex", gap: 8 }}>
            <MapPin size={16} /> {empresa?.direccion ?? "-"}
          </div>
        </div>
        {clienteId && (
              <Button text="Crear vehículo" onClick={() => setOpenVehiculo(true)} />
            )}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <Card style={styles.contentPanel}>
          <h2>Datos de contacto</h2>
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
              label={empresa?.email ?? "-"}
            />
            <IconLabel
              icon={<Phone size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
              label={empresa?.telefono ?? "-"}
            />
          </div>
        </Card>

        <Card style={styles.contentPanel}>
          <h2>Vehículos asociados</h2>
          <Divider />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {vehiculosLocal && vehiculosLocal.length > 0 ? (
              vehiculosLocal.map((vehiculo: Vehiculo) => (
                <span
                  key={vehiculo.id ?? vehiculo.patente ?? Math.random()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                  }}
                >
                  <strong>{vehiculo.patente ?? "-"}</strong>-<span>
                    {vehiculo.marca ?? "-"} {vehiculo.modelo ?? "-"}
                  </span>
                </span>
              ))
            ) : (
              <span>No hay vehículos asociados</span>
            )}
          </div>
        </Card>
      </div>

      <CreateVehiculoModal
        open={openVehiculo}
        onClose={(nuevo) => {
          setOpenVehiculo(false);
          if (nuevo) {
            setVehiculosLocal((prev) => [
              { id: Math.random(), nombre_cliente: empresa?.nombre || '', patente: nuevo.patente, marca: nuevo.marca || '', modelo: nuevo.modelo || '', fecha_patente: nuevo.fecha_patente || '' },
              ...prev,
            ]);
          }
        }}
        clienteId={clienteId ?? ''}
      />
    </div>
  );
}

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "50%",
  },
} as const;
