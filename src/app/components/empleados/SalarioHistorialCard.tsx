"use client";

import React, { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Button from "@/app/components/ui/Button";
import SectionCard from "@/app/components/empleados/SectionCard";
import { useEmpleados, type Empleado, type SalarioHistorial } from "@/app/providers/EmpleadosProvider";
import SalarioUpdateModal from "./SalarioUpdateModal";

type Props = {
  empleado: Empleado;
  onSalarioUpdated: (updated: Empleado) => void;
};

function formatSalario(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(isoDate: string): string {
  if (!isoDate) return "—";
  const [year, month] = isoDate.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[Number(month) - 1]} ${year}`;
}

export default function SalarioHistorialCard({ empleado, onSalarioUpdated }: Props) {
  const { getSalarioHistory } = useEmpleados();
  const [historial, setHistorial] = useState<SalarioHistorial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const { data } = await getSalarioHistory(empleado.id);
    setHistorial(data);
    setIsLoading(false);
  }, [getSalarioHistory, empleado.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleSaved = (updated: Empleado) => {
    onSalarioUpdated(updated);
    void loadHistory();
  };

  const action = (
    <Button
      text="Actualizar salario"
      onClick={() => setIsModalOpen(true)}
      style={{ fontSize: 13, padding: "6px 12px", minWidth: 0 }}
      hideTextOnMobile={false}
    />
  );

  return (
    <>
      <SectionCard
        icon={<TrendingUp size={16} color={COLOR.TEXT.SECONDARY} />}
        title="Historial salarial"
        action={action}
      >
        {isLoading ? (
          <div style={styles.empty}>Cargando...</div>
        ) : historial.length === 0 ? (
          <div style={styles.empty}>Sin historial registrado.</div>
        ) : (
          <div style={styles.list}>
            {historial.map((item, index) => (
              <div key={item.id} style={styles.row}>
                <div style={styles.dotCol}>
                  <div style={{ ...styles.dot, ...(index === 0 ? styles.dotActive : {}) }} />
                  {index < historial.length - 1 && <div style={styles.line} />}
                </div>
                <div style={styles.rowContent}>
                  <div style={styles.rowMonth}>{formatMonth(item.vigenteDesde)}</div>
                  <div style={styles.rowSalario}>{formatSalario(item.salario)}</div>
                  {index === 0 && <span style={styles.badge}>Actual</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SalarioUpdateModal
        open={isModalOpen}
        empleado={empleado}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}

const styles = {
  empty: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    padding: "8px 0",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
  },
  row: {
    display: "flex",
    gap: 12,
  },
  dotCol: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    width: 16,
    flexShrink: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: COLOR.BORDER.DEFAULT,
    marginTop: 4,
    flexShrink: 0,
  },
  dotActive: {
    background: COLOR.ACCENT.PRIMARY,
    width: 12,
    height: 12,
  },
  line: {
    width: 2,
    flex: 1,
    background: COLOR.BORDER.SUBTLE,
    minHeight: 16,
  },
  rowContent: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 16,
    flex: 1,
  },
  rowMonth: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    minWidth: 72,
  },
  rowSalario: {
    fontSize: 15,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 20,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
  },
} as const;
