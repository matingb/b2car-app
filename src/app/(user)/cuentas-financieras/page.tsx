"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Plus, RefreshCw, WalletCards } from "lucide-react";
import { css } from "@emotion/react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { useToast } from "@/app/providers/ToastProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import CuentasFinancierasCard from "@/app/components/finanzas/CuentasFinancierasCard";
import CuentaFinancieraModal, {
  type CuentaFinancieraDraft,
} from "@/app/components/finanzas/CuentaFinancieraModal";
import TransferenciaFinancieraModal, {
  type TransferenciaFinancieraDraft,
} from "@/app/components/finanzas/TransferenciaFinancieraModal";
import { formatArs } from "@/lib/format";

type EstadoFilter = "todas" | "activas" | "inactivas";

export default function CuentasFinancierasPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const {
    cuentas,
    cuentasActivas,
    saldoTotal,
    loading,
    loadError,
    refresh,
    createCuenta,
    updateCuenta,
    createTransferencia,
  } = useCuentasFinancieras();

  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFilter>("todas");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const cuentasFiltradas = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cuentas.filter((cuenta) => {
      const matchesEstado =
        estado === "todas" || (estado === "activas" ? cuenta.activo : !cuenta.activo);
      const matchesSearch =
        !query ||
        [cuenta.nombre, cuenta.tipo]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      return matchesEstado && matchesSearch;
    });
  }, [cuentas, estado, search]);

  const handleCreate = async (draft: CuentaFinancieraDraft) => {
    const created = await createCuenta({
      nombre: draft.nombre,
      tipo: draft.tipo,
      saldoInicial: draft.saldoInicial,
    });
    success("Cuenta creada", `${created.nombre} se registró correctamente.`);
  };

  const handleTransfer = async (draft: TransferenciaFinancieraDraft) => {
    await createTransferencia({
      cuentaOrigenId: draft.cuentaOrigenId,
      cuentaDestinoId: draft.cuentaDestinoId,
      importe: draft.importe,
      fecha: draft.fecha,
      descripcion: draft.descripcion || null,
    });
    success("Transferencia registrada", "Los saldos de las cuentas fueron actualizados.");
  };

  const handleFavorite = async (cuentaId: string, cuentaNombre: string) => {
    try {
      await updateCuenta(cuentaId, { favorita: true });
      success("Cuenta favorita actualizada", `${cuentaNombre} sera la cuenta sugerida para los cobros.`);
    } catch (cause: unknown) {
      errorToast(
        "No se pudo actualizar la cuenta favorita",
        cause instanceof Error ? cause.message : "Error inesperado"
      );
    }
  };

  return (
    <div>
      <div css={styles.headerRow}>
        <ScreenHeader
          title="Cuentas financieras"
          subtitle="Consultá tus saldos y registrá los movimientos de caja, bancos y billeteras."
        />
        <div css={styles.actions}>
          <Button
            outline
            icon={<ArrowLeftRight size={18} />}
            text="Transferir"
            onClick={() => setIsTransferOpen(true)}
            disabled={cuentasActivas.length < 2}
            css={styles.actionButton}
          />
          <Button
            icon={<Plus size={18} />}
            text="Nueva cuenta"
            onClick={() => setIsCreateOpen(true)}
            css={styles.actionButton}
          />
        </div>
      </div>

      <div css={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryIcon}>
            <WalletCards size={20} />
          </div>
          <div>
            <div style={styles.summaryLabel}>Cuentas activas</div>
            <strong style={styles.summaryValue}>{cuentasActivas.length}</strong>
          </div>
        </Card>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Saldo disponible</div>
          <strong style={{ ...styles.summaryValue, color: saldoTotal < 0 ? COLOR.ICON.DANGER : COLOR.TEXT.PRIMARY }}>
            {formatArs(saldoTotal)}
          </strong>
        </Card>
      </div>

      <div css={styles.toolbar}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o tipo..."
          style={{ width: "100%" }}
        />
        <div css={styles.filters} aria-label="Filtrar cuentas por estado">
          {(
            [
              ["todas", "Todas"],
              ["activas", "Activas"],
              ["inactivas", "Inactivas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setEstado(value)}
              css={[styles.filter, estado === value && styles.filterSelected]}
              data-testid={`cuentas-financieras-filter-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.resultsHeader}>
        <div style={styles.resultsTitle}>Listado</div>
        <div style={styles.resultsCount}>
          {cuentasFiltradas.length} de {cuentas.length} cuentas
        </div>
      </div>

      {loading ? (
        <div style={styles.status} role="status">
          Cargando cuentas...
        </div>
      ) : loadError ? (
        <Card style={styles.errorCard}>
          <div style={styles.errorTitle}>No se pudieron cargar las cuentas.</div>
          <div style={styles.errorText}>{loadError}</div>
          <Button
            outline
            icon={<RefreshCw size={16} />}
            text="Reintentar"
            onClick={() => void refresh()}
            hideTextOnMobile={false}
            style={{ marginTop: 12 }}
          />
        </Card>
      ) : cuentasFiltradas.length === 0 ? (
        <Card style={styles.emptyCard}>
          <WalletCards size={26} color={COLOR.TEXT.TERTIARY} />
          <div style={styles.emptyTitle}>
            {cuentas.length === 0 ? "Todavía no hay cuentas financieras" : "No hay cuentas para esos filtros"}
          </div>
          <div style={styles.emptyText}>
            {cuentas.length === 0
              ? "Creá una cuenta para comenzar a registrar ingresos, gastos y transferencias."
              : "Probá cambiando la búsqueda o el estado seleccionado."}
          </div>
          {cuentas.length === 0 ? (
            <Button
              icon={<Plus size={18} />}
              text="Nueva cuenta"
              onClick={() => setIsCreateOpen(true)}
              hideTextOnMobile={false}
              style={{ marginTop: 4 }}
            />
          ) : null}
        </Card>
      ) : (
        <div css={styles.cardsGrid}>
          {cuentasFiltradas.map((cuenta) => (
            <CuentasFinancierasCard
              key={cuenta.id}
              nombre={cuenta.nombre}
              tipo={cuenta.tipo}
              saldo={cuenta.saldoActual}
              activo={cuenta.activo}
              favorita={cuenta.favorita}
              onFavorite={() => void handleFavorite(cuenta.id, cuenta.nombre)}
              onClick={() => router.push(`${ROUTES.cuentasFinancieras}/${cuenta.id}`)}
            />
          ))}
        </div>
      )}

      <CuentaFinancieraModal
        open={isCreateOpen}
        showActivo={false}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
      />
      <TransferenciaFinancieraModal
        open={isTransferOpen}
        cuentas={cuentas}
        onClose={() => setIsTransferOpen(false)}
        onCreate={handleTransfer}
      />
    </div>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  }),
  actions: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  }),
  actionButton: css({
    minWidth: 0,
    height: 40,
  }),
  summaryGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  summaryCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  summaryIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  summaryLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  summaryValue: { display: "block", marginTop: 2, fontSize: 22 },
  toolbar: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 16,
  }),
  filters: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }),
  filter: css({
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 999,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    padding: "7px 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    "&:hover": { borderColor: COLOR.ACCENT.PRIMARY },
  }),
  filterSelected: css({
    color: COLOR.TEXT.CONTRAST,
    background: COLOR.ACCENT.PRIMARY,
    borderColor: COLOR.ACCENT.PRIMARY,
  }),
  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginTop: 18,
  },
  resultsTitle: { fontSize: 18, fontWeight: 700 },
  resultsCount: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  cardsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  status: {
    minHeight: 160,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.TEXT.SECONDARY,
  },
  errorCard: { marginTop: 12, background: COLOR.BACKGROUND.DANGER_TINT },
  errorTitle: { color: COLOR.ICON.DANGER, fontWeight: 700 },
  errorText: { color: COLOR.TEXT.SECONDARY, fontSize: 13, marginTop: 4 },
  emptyCard: {
    marginTop: 12,
    minHeight: 190,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    gap: 7,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  emptyTitle: { fontWeight: 700, marginTop: 2 },
  emptyText: { color: COLOR.TEXT.SECONDARY, fontSize: 13, maxWidth: 440 },
} as const;
