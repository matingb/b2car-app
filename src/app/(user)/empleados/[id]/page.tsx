"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import IconButton from "@/app/components/ui/IconButton";
import { useEmpleados, type Empleado } from "@/app/providers/EmpleadosProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { ROUTES } from "@/routing/routes";
import EmpleadoEditModal from "@/app/components/empleados/EmpleadoEditModal";
import EmpleadoProfileCard from "@/app/components/empleados/EmpleadoProfileCard";
import EmpleadoInfoPersonalCard from "@/app/components/empleados/EmpleadoInfoPersonalCard";
import EmpleadoContactoCard from "@/app/components/empleados/EmpleadoContactoCard";
import SalarioHistorialCard from "@/app/components/empleados/SalarioHistorialCard";

function PageHeader() {
  return (
    <ScreenHeader
      title="Empleados"
      breadcrumbs={["Detalle"]}
      hasBackButton
      style={{ width: "100%" }}
    />
  );
}

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
    return (
      talleres.find((t) => t.id === empleado.tallerId)?.nombre ??
      "Taller no encontrado"
    );
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
    success(
      "Empleado eliminado",
      `${empleado.nombre} ${empleado.apellido} se eliminó correctamente.`,
    );
    router.push(ROUTES.empleados);
  }, [confirm, empleado, errorToast, removeEmpleado, router, success]);

  if (notFound) {
    return (
      <div>
        <PageHeader />
        <div style={styles.statusText}>
          No se encontró el empleado solicitado.
        </div>
      </div>
    );
  }

  if (isLoading && !empleado) {
    return (
      <div>
        <PageHeader />
        <div style={styles.statusText}>Cargando...</div>
      </div>
    );
  }

  if (!empleado) {
    return (
      <div>
        <PageHeader />
        <div style={styles.statusText}>Cargando...</div>
      </div>
    );
  }

  return (
    <div css={styles.container}>
      <div css={styles.headerRow}>
        <PageHeader />
        <div style={styles.actions}>
          <IconButton
            icon={<Trash />}
            onClick={handleDelete}
            title="Eliminar"
            ariaLabel="Eliminar"
            hoverColor={COLOR.ICON.DANGER}
          />
        </div>
      </div>

      <EmpleadoProfileCard empleado={empleado} tallerNombre={tallerNombre} />

      <div style={styles.sections}>
        <div css={styles.cardsRow}>
          <div css={styles.cardColumn}>
            <EmpleadoContactoCard
              empleado={empleado}
              onEdit={() => setIsEditOpen(true)}
            />
          </div>

          <div css={styles.cardColumn}>
            <EmpleadoInfoPersonalCard empleado={empleado} />
          </div>
        </div>

        <SalarioHistorialCard
          empleado={empleado}
          onSalarioUpdated={setEmpleado}
        />
      </div>

      <EmpleadoEditModal
        open={isEditOpen}
        empleado={empleado}
        onClose={() => setIsEditOpen(false)}
        onSaved={setEmpleado}
      />
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 0,
  }),
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
  sections: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  cardsRow: css({
    display: "flex",
    gap: 16,
    alignItems: "stretch",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
    },
  }),
  cardColumn: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    flex: "1 1 0",
    minWidth: 0,
  }),
  statusText: {
    marginTop: 16,
    color: COLOR.TEXT.SECONDARY,
  },
} as const;
