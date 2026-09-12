"use client";

import React from "react";
import {
  Building2,
  Car,
  FileText,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Cliente, TipoCliente } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useClientes } from "@/app/providers/ClientesProvider";
import { formatTelephoneNumber } from "@/lib/telefono";
import { getInitials } from "@/lib/initials";
import { css } from "@emotion/react";
import { clientesClient } from "@/clients/clientes/clientesClient";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import ExpandButton from "../ui/ExpandButton";

function DataCell({
  icon,
  text,
  isMissing = false,
  title,
}: {
  icon: React.ReactNode;
  text: string;
  isMissing?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title ?? text}
      css={[styles.dataCell, isMissing && styles.dataCellMissing]}
    >
      <div css={[styles.dataCellIcon, isMissing && styles.dataCellIconMissing]}>
        {icon}
      </div>
      <span css={styles.dataCellText}>{text}</span>
    </div>
  );
}

export default function ClienteItem({ cliente }: { cliente: Cliente }) {
  const modal = useModalMessage();
  const router = useRouter();
  const toast = useToast();
  const { deleteCliente } = useClientes();

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nombre = cliente.nombre || "este cliente";
    const ok = await modal.confirm({
      title: "Eliminar cliente",
      message: `¿Confirmás eliminar ${nombre}? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteCliente(cliente.id, cliente.tipo_cliente);
      toast.success(
        "Cliente eliminado",
        `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} se eliminó correctamente.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error de red";
      toast.error("No se pudo eliminar el cliente", message);
    }
  };

  const handleOnClick = () => {
    const tipo =
      cliente.tipo_cliente === TipoCliente.PARTICULAR
        ? "PARTICULAR"
        : "EMPRESA";
    localStorage.setItem("tipo_cliente", tipo);
    router.push(ROUTES.clientes + "/" + cliente.id);
  };

  const initials = getInitials(cliente.nombre);
  const isEmpresa = cliente.tipo_cliente === TipoCliente.EMPRESA;
  const tipoLabel = isEmpresa ? "Empresa" : "Particular";
  const cuitOrDoc =
    cliente.cuit
      ? `CUIT: ${cliente.cuit}`
      : cliente.numero_documento_fiscal
      ? `Doc: ${cliente.numero_documento_fiscal}`
      : null;

  const formattedPhone = cliente.telefono
    ? formatTelephoneNumber(cliente.codigo_pais, cliente.telefono)
    : "";

  const rawVehicles = cliente.vehiculos ?? cliente.vehiculos_count;
  const vehiclesCount = Array.isArray(rawVehicles)
    ? rawVehicles.length
    : typeof rawVehicles === "number"
    ? rawVehicles
    : undefined;

  const hasVehicles = vehiclesCount !== undefined && vehiclesCount > 0;
  const vehiclesText = hasVehicles
    ? `${vehiclesCount} ${vehiclesCount === 1 ? "Vehículo" : "Vehículos"}`
    : "Sin vehículos";

  const [saldoLoaded, setSaldoLoaded] = React.useState<number | undefined>(cliente.saldo_cuenta);

  React.useEffect(() => {
    if (cliente.saldo_cuenta !== undefined) {
      setSaldoLoaded(cliente.saldo_cuenta);
      return;
    }

    let cancelled = false;
    const promise = clientesClient.getResumenFinanciero?.(cliente.id);
    if (promise && typeof promise.then === "function") {
      promise
        .then((res) => {
          if (!cancelled && res?.data?.saldo_cuenta !== undefined) {
            setSaldoLoaded(res.data.saldo_cuenta);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [cliente.id, cliente.saldo_cuenta]);

  // saldo_cuenta es neto: positivo = deuda, negativo = saldo a favor.
  const currentSaldo = saldoLoaded ?? cliente.saldo_cuenta ?? 0;
  const debt = currentSaldo > 0 ? currentSaldo : 0;
  const credit = currentSaldo < 0 ? Math.abs(currentSaldo) : 0;
  const hasDebt = debt > 0;
  const hasCredit = credit > 0;

  const [isExpanded, setIsExpanded] = React.useState(false);

  const toggleExpand = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <Card
      onClick={handleOnClick}
      data-testid="cliente-item"
      css={styles.card}
    >
      {/* Top / Identity Row: In desktop it unwraps via display: contents; in mobile it is a compact header */}
      <div css={styles.topRow}>
        {/* Left: Client Identity */}
        <div css={styles.identity}>
          <div css={styles.avatar} title={cliente.nombre}>
            {initials}
          </div>
          <div css={styles.identityText}>
            <h3 css={styles.name} title={cliente.nombre}>
              {cliente.nombre}
            </h3>
            <div css={styles.metaRow}>
              <span css={styles.typeBadge} title={`Tipo: ${tipoLabel}`}>
                {isEmpresa ? (
                  <Building2 size={14} />
                ) : (
                  <UserIcon size={14} />
                )}
                <span>{tipoLabel}</span>
              </span>
              {cuitOrDoc && (
                <>
                  <span css={styles.separator}>•</span>
                  <span css={styles.docBadge} title={cuitOrDoc}>
                    <FileText size={14} />
                    <span>{cuitOrDoc}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Client Status & Actions */}
        <div css={styles.statusSection}>
          {hasDebt ? (
            <div
              css={styles.balanceBlock}
              title={`Saldo pendiente a cobrar: $${debt.toLocaleString("es-AR")}`}
            >
              <div css={styles.debtAmount} data-testid="cliente-debt-amount">
                {`$${debt.toLocaleString("es-AR")}`}
              </div>
              <div css={styles.debtBadge} data-testid="cliente-debt-badge">
                A Cobrar
              </div>
            </div>
          ) : hasCredit ? (
            <div
              css={styles.balanceBlock}
              title={`Saldo a favor: $${credit.toLocaleString("es-AR")}`}
            >
              <div css={styles.creditAmount} data-testid="cliente-credit-amount">
                {`$${credit.toLocaleString("es-AR")}`}
              </div>
              <div css={styles.creditBadge} data-testid="cliente-credit-badge">
                Saldo a favor
              </div>
            </div>
          ) : (
            <div
              css={styles.balanceBlock}
              title="Cuenta corriente al día ($0)"
            >
              <div css={styles.cleanAmount} data-testid="cliente-clean-amount">
                $0
              </div>
              <div css={styles.cleanBadge} data-testid="cliente-clean-badge">
                Al día
              </div>
            </div>
          )}

          <div css={styles.deleteDivider}>
            <IconButton
              icon={<Trash2 />}
              onClick={handleDelete}
              title="Eliminar cliente"
              ariaLabel="Eliminar cliente"
              hoverColor={COLOR.ICON.DANGER}
              data-testid="cliente-delete-btn"
            />
          </div>

          <ExpandButton
            isExpanded={isExpanded}
            onToggle={toggleExpand}
            title={isExpanded ? "Menos detalles" : "Más detalles"}
            ariaLabel={
              isExpanded
                ? "Colapsar detalles del cliente"
                : "Expandir detalles del cliente"
            }
            dataTestId="cliente-expand-btn"
          />
        </div>
      </div>

      {/* Center / Collapsible: Data Grid */}
      <div css={[styles.dataGrid, isExpanded ? styles.dataGridOpenMobile : styles.dataGridClosedMobile]}>
        <DataCell
          icon={<Phone size={16} />}
          text={formattedPhone || "Sin teléfono"}
          title={formattedPhone ? `Teléfono: ${formattedPhone}` : "Sin teléfono"}
          isMissing={!cliente.telefono}
        />
        <DataCell
          icon={<Mail size={16} />}
          text={cliente.email || "Sin correo"}
          title={cliente.email ? `Correo: ${cliente.email}` : "Sin correo"}
          isMissing={!cliente.email}
        />
        <DataCell
          icon={<MapPin size={16} />}
          text={cliente.direccion || "Sin dirección"}
          title={cliente.direccion ? `Dirección: ${cliente.direccion}` : "Sin dirección"}
          isMissing={!cliente.direccion}
        />
        <DataCell
          icon={<Car size={16} />}
          text={vehiclesText}
          title={vehiclesText}
          isMissing={!hasVehicles}
        />
      </div>
    </Card>
  );
}

const styles = {
  card: css({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    cursor: "pointer",
    transition: "border-color 200ms ease, box-shadow 200ms ease",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      boxShadow: "0 2px 8px rgba(0, 128, 162, 0.12)",
    },
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      flexDirection: "column",
      alignItems: "stretch",
      gap: 0,
      padding: "12px 14px",
    },
  }),
  topRow: css({
    display: "contents",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      width: "100%",
      order: 1,
    },
  }),
  identity: css({
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexShrink: 0,
    width: 270,
    minWidth: 0,
    order: 1,
    [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
      width: 240,
    },
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: "auto",
      flex: 1,
      gap: 10,
    },
  }),
  avatar: css({
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: 40,
      height: 40,
      fontSize: 14,
    },
  }),
  identityText: css({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  }),
  name: css({
    margin: 0,
    fontWeight: 700,
    fontSize: 16,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 15,
    },
  }),
  metaRow: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  }),
  typeBadge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  }),
  separator: css({
    color: COLOR.BORDER.WEAK,
  }),
  docBadge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  }),
  dataGrid: css({
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    columnGap: 20,
    rowGap: 10,
    minWidth: 0,
    padding: "0 20px",
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
    order: 2,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      borderLeft: "none",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px 16px",
      width: "100%",
      overflow: "hidden",
      transition:
        "max-height 240ms ease, opacity 200ms ease, transform 200ms ease, margin-top 240ms ease, padding-top 240ms ease",
      transformOrigin: "top",
    },
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
      gap: 8,
    },
  }),
  dataGridOpenMobile: css({
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      maxHeight: 600,
      opacity: 1,
      transform: "translateY(0)",
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    },
  }),
  dataGridClosedMobile: css({
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      maxHeight: 0,
      opacity: 0,
      transform: "translateY(-4px)",
      pointerEvents: "none",
      marginTop: 0,
      paddingTop: 0,
      borderTop: "1px solid transparent",
    },
  }),
  dataCell: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    minWidth: 0,
  }),
  dataCellMissing: css({
    color: COLOR.BORDER.WEAK,
  }),
  dataCellIcon: css({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    color: COLOR.ICON.MUTED,
  }),
  dataCellIconMissing: css({
    color: COLOR.BORDER.SUBTLE,
  }),
  dataCellText: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  }),
  statusSection: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    flexShrink: 0,
    width: 190,
    order: 3,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: "auto",
      order: 2,
      gap: 6,
    },
  }),
  balanceBlock: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flex: 1,
    },
  }),
  debtAmount: css({
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.SEMANTIC.DANGER,
    lineHeight: 1,
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 15,
      marginBottom: 3,
    },
  }),
  cleanAmount: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.BORDER.WEAK,
    lineHeight: 1,
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 14,
      marginBottom: 3,
    },
  }),
  creditAmount: css({
    fontSize: 18,
    fontWeight: 900,
    color: COLOR.SEMANTIC.INFO,
    lineHeight: 1,
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 15,
      marginBottom: 3,
    },
  }),
  debtBadge: css({
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLOR.SEMANTIC.DANGER,
    backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    padding: "2px 6px",
    borderRadius: 4,
    display: "inline-block",
  }),
  cleanBadge: css({
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLOR.SEMANTIC.SUCCESS,
    backgroundColor: COLOR.BACKGROUND.SUCCESS_TINT,
    padding: "2px 6px",
    borderRadius: 4,
    display: "inline-block",
  }),
  creditBadge: css({
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLOR.SEMANTIC.INFO,
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    padding: "2px 6px",
    borderRadius: 4,
    display: "inline-block",
  }),
  deleteDivider: css({
    display: "flex",
    alignItems: "center",
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingLeft: 16,
    marginLeft: 8,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
} as const;
