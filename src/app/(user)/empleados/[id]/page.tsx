"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import IconButton from "@/app/components/ui/IconButton";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CreditCard,
  DollarSign,
  Mail,
  Pencil,
  Phone,
  Trash,
  User,
} from "lucide-react";
import { useEmpleados, type Empleado } from "@/app/providers/EmpleadosProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { ROUTES } from "@/routing/routes";
import EmpleadoEditModal from "@/app/components/empleados/EmpleadoEditModal";

function getInitials(nombre: string, apellido: string) {
  const a = nombre.trim().charAt(0);
  const b = apellido.trim().charAt(0);
  return `${a}${b}`.toUpperCase();
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatSalario(amount: number | null) {
  if (amount === null) return "Sin definir";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

const Header = () => (
  <ScreenHeader
    title="Empleados"
    breadcrumbs={["Detalle"]}
    hasBackButton
    style={{ width: "100%" }}
  />
);

export default function EmpleadoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getEmpleadoById, removeEmpleado, isLoading } = useEmpleados();
  const { talleres } = useTenant();
  const { confirm } = useModalMessage();
  const { success, error: errorToast } = useToast();

  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getEmpleadoById(params.id);
      if (cancelled) return;
      if (!res) {
        setNotFound(true);
        setEmpleado(null);
        return;
      }
      setNotFound(false);
      setEmpleado(res);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [getEmpleadoById, params.id]);

  const tallerNombre = useMemo(() => {
    if (!empleado) return "";
    return talleres.find((t) => t.id === empleado.tallerId)?.nombre ?? "Taller no encontrado";
  }, [empleado, talleres]);

  const handleDelete = useCallback(async () => {
    if (!empleado) return;
    const ok = await confirm({
      title: "Eliminar empleado",
      message: `¿Eliminar a "${empleado.nombre} ${empleado.apellido}"? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const { error } = await removeEmpleado(empleado.id);
    if (error) {
      errorToast("No se pudo eliminar el empleado", error);
      return;
    }
    success("Empleado eliminado", `${empleado.nombre} ${empleado.apellido} se eliminó correctamente.`);
    router.push(ROUTES.empleados);
  }, [confirm, empleado, errorToast, removeEmpleado, router, success]);

  if (notFound) {
    return (
      <div>
        <Header />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>
          No se encontró el empleado solicitado.
        </div>
      </div>
    );
  }

  if (isLoading && !empleado) {
    return (
      <div>
        <Header />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (!empleado) {
    return (
      <div>
        <Header />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  const initials = getInitials(empleado.nombre, empleado.apellido);

  return (
    <div>
      <div css={styles.headerRow}>
        <Header />
        <div style={styles.actions}>
          <IconButton
            icon={<Trash />}
            onClick={handleDelete}
            title="Eliminar"
            ariaLabel="Eliminar"
            hoverColor={COLOR.ICON.DANGER}
          />
          <IconButton
            icon={<Pencil />}
            onClick={() => setIsEditOpen(true)}
            title="Editar"
            ariaLabel="Editar"
          />
        </div>
      </div>

      <div style={styles.profileCard}>
        <div style={styles.profileBanner} />
        <div style={styles.profileBody}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>{initials}</span>
          </div>

          <div style={styles.titleBlock}>
            <h2 style={styles.title}>
              {empleado.nombre} {empleado.apellido}
            </h2>
            <div style={styles.subtitleRow}>
              <Briefcase size={14} color={COLOR.TEXT.SECONDARY} />
              <span style={styles.subtitleText}>{tallerNombre}</span>
            </div>
          </div>
        </div>
      </div>

      <div css={styles.grid}>
        <div style={styles.col}>
          <div style={styles.sectionCard}>
            <div style={styles.sectionTitleRow}>
              <User size={16} color={COLOR.TEXT.SECONDARY} />
              <h3 style={styles.sectionTitle}>Información personal</h3>
            </div>
            <div css={styles.dlGrid}>
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
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionTitleRow}>
              <Mail size={16} color={COLOR.TEXT.SECONDARY} />
              <h3 style={styles.sectionTitle}>Contacto</h3>
            </div>
            <div style={styles.contactList}>
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
          </div>
        </div>

        <div style={styles.col}>
          <div style={styles.sectionCard}>
            <div style={styles.sectionTitleRow}>
              <Building2 size={16} color={COLOR.TEXT.SECONDARY} />
              <h3 style={styles.sectionTitle}>Laboral</h3>
            </div>

            <DefinitionItem label="Taller asignado" value={tallerNombre} />

            <div style={styles.salarioBlock}>
              <div style={styles.salarioLabel}>Salario actual</div>
              <div style={styles.salarioRow}>
                <DollarSign size={22} color={COLOR.ACCENT.PRIMARY} />
                <span style={styles.salarioAmount}>
                  {empleado.salario === null
                    ? "Sin definir"
                    : formatSalario(empleado.salario).replace("$", "").trim()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EmpleadoEditModal
        open={isEditOpen}
        empleado={empleado}
        onClose={() => setIsEditOpen(false)}
        onSaved={(updated) => setEmpleado(updated)}
      />
    </div>
  );
}

function DefinitionItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div style={styles.dt}>{label}</div>
      <div style={styles.dd}>
        {icon ? <span style={styles.ddIcon}>{icon}</span> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={styles.contactRow}>
      <div style={styles.contactIcon}>{icon}</div>
      <div>
        <div style={styles.dt}>{label}</div>
        <div style={styles.contactValue}>{value}</div>
      </div>
    </div>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  profileCard: {
    marginTop: 12,
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden",
  },
  profileBanner: {
    height: 64,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  profileBody: {
    padding: "0 20px 20px",
    display: "flex",
    alignItems: "flex-end",
    gap: 16,
    marginTop: -32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.SECONDARY,
    border: `4px solid ${COLOR.BACKGROUND.SECONDARY}`,
    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.ACCENT.PRIMARY,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 700,
    background: COLOR.BACKGROUND.INFO_TINT,
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
  },
  subtitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  subtitleText: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  grid: css({
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  col: { display: "flex", flexDirection: "column" as const, gap: 12 },
  sectionCard: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  dlGrid: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  dt: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 4,
  },
  dd: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 500,
    fontSize: 14,
  },
  ddIcon: { display: "inline-flex" },
  contactList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  contactRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.INFO_TINT,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
  },
  salarioBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  salarioLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 6,
  },
  salarioRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  salarioAmount: {
    fontSize: 26,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
    lineHeight: 1.1,
  },
} as const;
