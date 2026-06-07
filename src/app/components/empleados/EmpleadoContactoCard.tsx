import React from "react";
import { Mail, Phone } from "lucide-react";
import { COLOR } from "@/theme/theme";
import SectionCard from "@/app/components/empleados/SectionCard";
import ContactRow from "@/app/components/ui/ContactRow";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

type Props = { empleado: Empleado };

export default function EmpleadoContactoCard({ empleado }: Props) {
  return (
    <SectionCard icon={<Mail size={16} color={COLOR.TEXT.SECONDARY} />} title="Contacto">
      <div style={styles.list}>
        <ContactRow
          icon={<Mail size={16} color={COLOR.ACCENT.PRIMARY} />}
          label="Correo electrónico"
          value={empleado.email || "—"}
        />
        <ContactRow
          icon={<Phone size={16} color={COLOR.ACCENT.PRIMARY} />}
          label="Teléfono"
          value={empleado.telefono || "—"}
        />
      </div>
    </SectionCard>
  );
}

const styles = {
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
} as const;