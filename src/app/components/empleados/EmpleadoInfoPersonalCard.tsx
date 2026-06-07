import React from "react";
import { Calendar, CalendarClock, CreditCard, User } from "lucide-react";
import { COLOR } from "@/theme/theme";
import SectionCard, { sectionCardStyles } from "@/app/components/empleados/SectionCard";
import DefinitionItem from "@/app/components/ui/DefinitionItem";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = { empleado: Empleado };

function formatDate(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export default function EmpleadoInfoPersonalCard({ empleado }: Props) {
  return (
    <SectionCard icon={<User size={16} color={COLOR.TEXT.SECONDARY} />} title="Información personal">
      <div css={sectionCardStyles.dlGrid}>
        <DefinitionItem
          label="Nombre completo"
          value={`${empleado.nombre} ${empleado.apellido}`}
        />
        <DefinitionItem
          label="DNI"
          value={empleado.dni}
          icon={<CreditCard size={14} color={COLOR.TEXT.SECONDARY} />}
        />
        <DefinitionItem
          label="Fecha de nacimiento"
          value={formatDate(empleado.cumpleanos)}
          icon={<Calendar size={14} color={COLOR.TEXT.SECONDARY} />}
        />
        <DefinitionItem
          label="Fecha de ingreso"
          value={formatDate(empleado.fechaIngreso)}
          icon={<CalendarClock size={14} color={COLOR.TEXT.SECONDARY} />}
        />
      </div>
    </SectionCard>
  );
}
