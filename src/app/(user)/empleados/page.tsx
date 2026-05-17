"use client";

import React, { useCallback, useMemo, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useEmpleadosFilters } from "@/app/hooks/empleados/useEmpleadosFilters";
import EmpleadosToolbar from "@/app/components/empleados/EmpleadosToolbar";
import EmpleadosFiltersModal from "@/app/components/empleados/EmpleadosFiltersModal";
import EmpleadoCreateModal from "@/app/components/empleados/EmpleadoCreateModal";
import EmpleadoItemCard from "@/app/components/empleados/EmpleadoItemCard";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { LoaderCircle } from "lucide-react";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { ROUTES } from "@/routing/routes";
import { css } from "@emotion/react";

export default function EmpleadosPage() {
  return <EmpleadosPageContent />;
}

function EmpleadosPageContent() {
  const router = useRouter();
  const { empleados, isLoading } = useEmpleados();
  const { talleres } = useTenant();

  const tallerNombrePorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of talleres) map.set(t.id, t.nombre);
    return map;
  }, [talleres]);

  const resolveTallerNombre = useCallback(
    (id: string) => tallerNombrePorId.get(id),
    [tallerNombrePorId]
  );

  const state = useEmpleadosFilters(empleados, resolveTallerNombre);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const showTallerFilter = talleres.length > 1;

  return (
    <div>
      <ScreenHeader
        title="Empleados"
        subtitle="Gestioná los datos personales y laborales del personal"
      />

      <div style={{ marginTop: 12 }}>
        <EmpleadosToolbar
          search={state.search}
          onSearchChange={state.setSearch}
          onOpenFilters={() => setIsFiltersOpen(true)}
          chips={state.chips}
          onChipClick={state.removeFilter}
          onClearFilters={state.clearFilters}
          onNewEmpleadoClick={() => setIsCreateOpen(true)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.resultsHeader}>
          <div style={styles.resultsTitle}>
            <h2>Listado</h2>
          </div>
          <div style={styles.resultsCount}>
            {state.empleadosFiltrados.length} de {empleados.length} empleados
          </div>
        </div>

        {!isLoading && state.empleadosFiltrados.length === 0 ? (
          <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
            <div style={styles.empty}>
              <div style={styles.emptyTitle}>No se encontraron empleados</div>
              <div style={styles.emptySub}>Probá ajustando búsqueda o filtros.</div>
            </div>
          </Card>
        ) : isLoading ? (
          <div style={styles.loading} data-testid="empleados-loading">
            <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
          </div>
        ) : (
          <div css={styles.list}>
            {state.empleadosFiltrados.map((e) => (
              <EmpleadoItemCard
                key={e.id}
                empleado={e}
                tallerNombre={tallerNombrePorId.get(e.tallerId)}
                onClick={() => router.push(`${ROUTES.empleados}/${e.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <EmpleadosFiltersModal
        open={isFiltersOpen}
        talleres={talleres}
        showTallerFilter={showTallerFilter}
        initial={state.filters}
        onClose={() => setIsFiltersOpen(false)}
        onApply={state.applyFilters}
      />

      <EmpleadoCreateModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}

const styles = {
  resultsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: { fontSize: 18, fontWeight: 700 },
  resultsCount: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  list: css({
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  }),
  loading: {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
  },
  empty: {
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: 700 },
  emptySub: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
} as const;
