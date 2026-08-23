"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Pencil,
  ReceiptText,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { css } from "@emotion/react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import type { CuentaFinanciera, MovimientoFinanciero } from "@/model/finanzas";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import CuentaFinancieraModal, {
  type CuentaFinancieraDraft,
} from "@/app/components/finanzas/CuentaFinancieraModal";
import TransferenciaFinancieraModal, {
  type TransferenciaFinancieraDraft,
} from "@/app/components/finanzas/TransferenciaFinancieraModal";
import MovimientosFinancierosCard from "@/app/components/finanzas/MovimientosFinancierosCard";
import {
  formatFinancialDate,
  formatMoney,
  getCuentaTipoLabel,
} from "@/app/components/finanzas/finanzasUtils";

export default function CuentaFinancieraDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useModalMessage();
  const { success, error: errorToast } = useToast();
  const cuentaId = params.id;

  const {
    cuentas,
    getCuentaById,
    updateCuenta,
    deleteCuenta,
    createTransferencia,
    getMovimientos,
  } = useCuentasFinancieras();

  const [cuenta, setCuenta] = useState<CuentaFinanciera | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [movimientosError, setMovimientosError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setMovimientosError(null);
    setNotFound(false);

    try {
      const [cuentaData, movsData] = await Promise.all([
        getCuentaById(cuentaId),
        getMovimientos(cuentaId).catch((err: unknown) => {
          setMovimientosError(
            err instanceof Error ? err.message : "Error cargando movimientos"
          );
          return [];
        }),
      ]);

      if (!cuentaData) {
        setNotFound(true);
        setCuenta(null);
      } else {
        setCuenta(cuentaData);
      }
      setMovimientos(movsData);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : "Error cargando cuenta"
      );
      setCuenta(null);
    } finally {
      setLoading(false);
    }
  }, [cuentaId, getCuentaById, getMovimientos]);

  useEffect(() => {
    void load();
  }, [load]);

  const editInitialValues = useMemo<CuentaFinancieraDraft | null>(() => {
    if (!cuenta) return null;
    return {
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      saldoInicial: cuenta.saldoInicial,
      activo: cuenta.activo,
    };
  }, [cuenta]);

  const handleSave = async (draft: CuentaFinancieraDraft) => {
    if (!cuenta) return;
    const updated = await updateCuenta(cuenta.id, {
      nombre: draft.nombre,
      tipo: draft.tipo,
      activo: draft.activo,
    });
    setCuenta(updated);
    success("Cuenta actualizada", "Los cambios se guardaron correctamente.");
  };

  const handleTransfer = async (draft: TransferenciaFinancieraDraft) => {
    await createTransferencia({
      cuentaOrigenId: draft.cuentaOrigenId,
      cuentaDestinoId: draft.cuentaDestinoId,
      importe: draft.importe,
      fecha: draft.fecha,
      descripcion: draft.descripcion || null,
    });
    success(
      "Transferencia registrada",
      "El movimiento aparece en el historial de la cuenta."
    );
    await load();
  };

  const handleDelete = async () => {
    if (!cuenta || deleting) return;
    const accepted = await confirm({
      title: "Eliminar cuenta financiera",
      message: `¿Querés eliminar la cuenta "${cuenta.nombre}"? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!accepted) return;

    setDeleting(true);
    try {
      await deleteCuenta(cuenta.id);
      success("Cuenta eliminada", `${cuenta.nombre} se eliminó correctamente.`);
      router.push(ROUTES.cuentasFinancieras);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo eliminar la cuenta";
      errorToast("No se pudo eliminar la cuenta", message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <ScreenHeader title="Cuenta financiera" hasBackButton />
        <div style={styles.pageStatus} role="status">
          Cargando cuenta...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <ScreenHeader title="Cuenta financiera" hasBackButton />
        <Card style={styles.errorCard}>
          <div style={styles.errorTitle}>No se pudo cargar la cuenta.</div>
          <div style={styles.errorText}>{loadError}</div>
          <Button
            outline
            icon={<RefreshCw size={16} />}
            text="Reintentar"
            onClick={() => void load()}
            hideTextOnMobile={false}
            style={{ marginTop: 12 }}
          />
        </Card>
      </div>
    );
  }

  if (notFound || !cuenta) {
    return (
      <div>
        <ScreenHeader title="Cuenta financiera" hasBackButton />
        <div style={styles.pageStatus}>No se encontró la cuenta solicitada.</div>
      </div>
    );
  }

  const saldoActual = Number(cuenta.saldoActual) || 0;
  const saldoInicial = Number(cuenta.saldoInicial) || 0;
  const hasTransferDestination = cuentas.filter((item) => item.activo && item.id !== cuenta.id).length > 0;
  const gastoUrl = `${ROUTES.operaciones}?nuevo=gasto&cuenta_financiera_id=${encodeURIComponent(cuenta.id)}`;

  return (
    <div css={styles.page}>
      <div css={styles.headerRow}>
        <ScreenHeader
          title={cuenta.nombre}
          breadcrumbs={["Cuentas financieras", "Detalle"]}
          hasBackButton
          style={{ width: "100%" }}
        />
        <div style={styles.iconActions}>
          <IconButton
            icon={<Pencil />}
            onClick={() => setIsEditOpen(true)}
            title="Editar cuenta"
            ariaLabel="Editar cuenta"
          />
          <IconButton
            icon={<Trash2 />}
            onClick={() => void handleDelete()}
            title={deleting ? "Eliminando..." : "Eliminar cuenta"}
            ariaLabel="Eliminar cuenta"
            hoverColor={COLOR.ICON.DANGER}
            disabled={deleting}
          />
        </div>
      </div>

      <Card style={styles.balanceCard}>
        <div css={styles.balanceTop}>
          <div>
            <div style={styles.type}>{getCuentaTipoLabel(cuenta.tipo)}</div>
            <div style={styles.balanceLabel}>Saldo actual</div>
            <div style={{ ...styles.balanceValue, color: saldoActual < 0 ? COLOR.ICON.DANGER : COLOR.TEXT.PRIMARY }}>
              {formatMoney(saldoActual)}
            </div>
          </div>
          <span
            style={{
              ...styles.status,
              ...(cuenta.activo ? styles.activeStatus : styles.inactiveStatus),
            }}
          >
            {cuenta.activo ? "Activa" : "Inactiva"}
          </span>
        </div>
        <div css={styles.balanceMeta}>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>Saldo inicial</span>
            <strong>{formatMoney(saldoInicial)}</strong>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>Creada</span>
            <strong>{formatFinancialDate(cuenta.createdAt)}</strong>
          </div>
        </div>
      </Card>

      {!cuenta.activo ? (
        <div style={styles.inactiveNotice} role="status">
          Esta cuenta está inactiva. Podés consultar su historial, pero no registrar nuevos gastos ni transferencias.
        </div>
      ) : null}

      <div css={styles.actionRow}>
        {cuenta.activo ? (
          <Link href={gastoUrl} style={styles.primaryLink} data-testid="cuenta-financiera-nuevo-gasto">
            <ReceiptText size={18} />
            Nuevo gasto
          </Link>
        ) : (
          <span style={{ ...styles.primaryLink, ...styles.disabledLink }} aria-disabled="true">
            <ReceiptText size={18} />
            Nuevo gasto
          </span>
        )}
        <Button
          outline
          icon={<ArrowLeftRight size={18} />}
          text="Transferir"
          onClick={() => setIsTransferOpen(true)}
          disabled={!cuenta.activo || !hasTransferDestination}
          hideTextOnMobile={false}
          css={styles.transferButton}
        />
      </div>

      <MovimientosFinancierosCard movimientos={movimientos} error={movimientosError} />

      <CuentaFinancieraModal
        open={isEditOpen}
        title="Editar cuenta"
        initialValues={editInitialValues}
        showSaldoInicial={false}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSave}
      />
      <TransferenciaFinancieraModal
        open={isTransferOpen}
        cuentas={cuentas}
        cuentaOrigenId={cuenta.id}
        onClose={() => setIsTransferOpen(false)}
        onCreate={handleTransfer}
      />
    </div>
  );
}

const styles = {
  page: css({ display: "flex", flexDirection: "column", gap: 16 }),
  headerRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  iconActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  balanceCard: { background: COLOR.BACKGROUND.SECONDARY },
  balanceTop: css({
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  }),
  type: { color: COLOR.TEXT.SECONDARY, fontSize: 14, fontWeight: 600 },
  balanceLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 13, marginTop: 16 },
  balanceValue: { marginTop: 3, fontSize: 32, fontWeight: 800, lineHeight: 1.2 },
  status: {
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  activeStatus: { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT },
  inactiveStatus: { color: COLOR.TEXT.SECONDARY, background: COLOR.BACKGROUND.DISABLED_TINT },
  balanceMeta: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 20,
    paddingTop: 14,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  metaItem: { display: "flex", flexDirection: "column" as const, gap: 3, fontSize: 14 },
  metaLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 12 },
  inactiveNotice: {
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.WARNING_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.4,
  },
  actionRow: css({
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  }),
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 40,
    boxSizing: "border-box" as const,
    padding: "8px 12px",
    borderRadius: 8,
    color: COLOR.TEXT.CONTRAST,
    background: COLOR.ACCENT.PRIMARY,
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 500,
  },
  disabledLink: { opacity: 0.55, cursor: "default" },
  transferButton: css({ minWidth: 0, height: 40 }),
  pageStatus: { marginTop: 16, color: COLOR.TEXT.SECONDARY },
  errorCard: { marginTop: 16, background: COLOR.BACKGROUND.DANGER_TINT },
  errorTitle: { color: COLOR.ICON.DANGER, fontWeight: 700 },
  errorText: { marginTop: 4, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
} as const;
