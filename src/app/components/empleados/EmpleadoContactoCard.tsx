import React from "react";
import { Calendar, CreditCard, Mail, Pencil, Phone } from "lucide-react";
import { COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import IconLabel from "@/app/components/ui/IconLabel";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = {
  empleado: Empleado;
  onEdit?: () => void;
};

function formatDate(iso: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export default function EmpleadoContactoCard({ empleado, onEdit }: Props) {
  return (
    <div style={styles.main}>
      <div style={styles.header}>
        <h3 style={styles.title}>Datos de contacto</h3>
        {onEdit && (
          <IconButton
            icon={<Pencil />}
            size={18}
            onClick={onEdit}
            title="Editar empleado"
            ariaLabel="Editar empleado"
          />
        )}
      </div>
      <Card style={styles.contentPanel}>
        <div style={styles.list}>
          <IconLabel
            icon={<Mail size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={empleado.email || "-"}
          />
          <IconLabel
            icon={<Phone size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={empleado.telefono || "-"}
          />
          <IconLabel
            icon={<CreditCard size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={`DNI ${empleado.dni || "-"}`}
          />
          <IconLabel
            icon={<Calendar size={18} style={{ color: COLOR.ACCENT.PRIMARY }} />}
            label={`Nacimiento ${formatDate(empleado.cumpleanos)}`}
          />
        </div>
      </Card>
    </div>
  );
}

const styles = {
  main: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
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
  title: {
    margin: 0,
  },
  contentPanel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    width: "100%",
    height: "100%",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
} as const;
