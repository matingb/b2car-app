"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import type { Proveedor } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { formatArs } from "@/lib/format";
import { getInitials } from "@/lib/initials";
import { openWhatsapp } from "@/lib/whatsapp";
import { css } from "@emotion/react";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import ExpandButton from "@/app/components/ui/ExpandButton";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

type Props = {
  proveedor: Proveedor;
  onEdit?: (proveedor: Proveedor) => void;
};

export default function ProveedorItemCard({ proveedor, onEdit }: Props) {
  const router = useRouter();
  const modal = useModalMessage();
  const toast = useToast();
  const { deleteProveedor } = useProveedores();

  const [isExpanded, setIsExpanded] = useState(false);
  const [saldoLoaded, setSaldoLoaded] = useState<number | undefined>(proveedor.saldo_pendiente);

  useEffect(() => {
    if (proveedor.saldo_pendiente !== undefined) {
      setSaldoLoaded(proveedor.saldo_pendiente);
      return;
    }

    let cancelled = false;
    proveedoresClient
      .getOperaciones(proveedor.id)
      .then((res) => {
        if (!cancelled && res?.data?.saldoAdeudado !== undefined) {
          setSaldoLoaded(res.data.saldoAdeudado);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [proveedor.id, proveedor.saldo_pendiente]);

  const currentSaldo = saldoLoaded ?? proveedor.saldo_pendiente ?? 0;
  const tieneDeuda = currentSaldo > 0;
  const tieneSaldoAFavor = currentSaldo < 0;
  const formattedMonto = formatArs(Math.abs(currentSaldo), { maxDecimals: 0, minDecimals: 0 });

  const handleCardClick = () => {
    router.push(ROUTES.proveedorDetalle(proveedor.id));
  };

  const toggleExpand = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await modal.confirm({
      title: "Eliminar proveedor",
      message: `¿Estás seguro de que querés eliminar a "${proveedor.nombre}"?`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteProveedor(proveedor.id);
      toast.success("Proveedor eliminado", `"${proveedor.nombre}" se eliminó correctamente.`);
    } catch (err: unknown) {
      toast.error(
        "No se pudo eliminar el proveedor",
        err instanceof Error ? err.message : "Error inesperado"
      );
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(proveedor);
  };

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!proveedor.telefono) return;
    openWhatsapp(proveedor.telefono, `Hola ${proveedor.nombre}, me comunico desde el taller.`);
  };

  const initials = getInitials(proveedor.nombre);
  const formattedCuit = proveedor.cuit?.trim()
    ? (proveedor.cuit.trim().toUpperCase().startsWith("CUIT")
        ? proveedor.cuit.trim()
        : `CUIT: ${proveedor.cuit.trim()}`)
    : null;

  return (
    <Card onClick={handleCardClick} data-testid={`proveedor-card-${proveedor.id}`} css={styles.card}>
      {/* Top / Identity Row: In desktop it unwraps via display: contents; in mobile/tablet it is a compact header */}
      <div css={styles.topRow}>
        <div css={styles.identity}>
          <div css={styles.avatar}>
            {initials ? initials : <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />}
          </div>

          <div css={styles.identityText}>
            <div css={styles.nameRow}>
              <h3 css={styles.name} title={proveedor.nombre}>
                {proveedor.nombre}
              </h3>
            </div>
          </div>
        </div>

        {/* Right: Saldo block & Expand toggle */}
        <div css={styles.statusSection}>
          <div css={styles.balanceBlock}>
            {tieneDeuda ? (
              <>
                <div
                  css={styles.debtAmount}
                  data-testid={`proveedor-debt-amount-${proveedor.id}`}
                  title={`Saldo pendiente de pago: ${formattedMonto}`}
                >
                  {formattedMonto}
                </div>
                <div
                  css={styles.debtBadge}
                  data-testid={`proveedor-debt-badge-${proveedor.id}`}
                >
                  Saldo pendiente
                </div>
              </>
            ) : tieneSaldoAFavor ? (
              <>
                <div
                  css={styles.creditAmount}
                  data-testid={`proveedor-credit-amount-${proveedor.id}`}
                  title={`Saldo a favor: ${formattedMonto}`}
                >
                  {formattedMonto}
                </div>
                <div
                  css={styles.creditBadge}
                  data-testid={`proveedor-credit-badge-${proveedor.id}`}
                >
                  Saldo a favor
                </div>
              </>
            ) : (
              <>
                <div
                  css={styles.cleanAmount}
                  data-testid={`proveedor-clean-amount-${proveedor.id}`}
                  title="Cuenta corriente al día ($0)"
                >
                  $0
                </div>
                <div
                  css={styles.cleanBadge}
                  data-testid={`proveedor-clean-badge-${proveedor.id}`}
                >
                  Al día
                </div>
              </>
            )}
          </div>

          {/* Desktop action buttons */}
          <div css={styles.desktopActions}>
            {proveedor.telefono && (
              <IconButton
                icon={<MessageCircle size={18} color="#25D366" />}
                title="WhatsApp"
                onClick={handleWhatsapp}
                data-testid={`proveedor-whatsapp-${proveedor.id}`}
              />
            )}

            <Can permission={Permission.ProveedoresEdit}>
              <IconButton
                icon={<Pencil size={18} />}
                title="Editar"
                onClick={handleEdit}
                data-testid={`proveedor-edit-${proveedor.id}`}
              />
              <IconButton
                icon={<Trash2 size={18} color={COLOR.SEMANTIC.DANGER} />}
                title="Eliminar"
                onClick={handleDelete}
                data-testid={`proveedor-delete-${proveedor.id}`}
              />
            </Can>
          </div>

          {/* Mobile expand button */}
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={toggleExpand}
            title={isExpanded ? "Menos detalles" : "Más detalles"}
            ariaLabel={
              isExpanded
                ? "Colapsar detalles del proveedor"
                : "Expandir detalles del proveedor"
            }
            dataTestId={`proveedor-expand-btn-${proveedor.id}`}
          />
        </div>
      </div>

      {/* Collapsible / Center Section: Contact data & mobile actions */}
      <div
        css={[
          styles.dataSection,
          isExpanded ? styles.dataSectionOpenMobile : styles.dataSectionClosedMobile,
        ]}
      >
        <div css={styles.contactDetails}>
          {formattedCuit && (
            <div
              css={styles.contactItem}
              title={formattedCuit}
              data-testid={`proveedor-cuit-${proveedor.id}`}
            >
              <div css={styles.contactIcon}>
                <FileText size={14} />
              </div>
              <span css={styles.contactText}>{formattedCuit}</span>
            </div>
          )}
          {proveedor.telefono && (
            <div
              css={styles.contactItem}
              title={`Teléfono: ${proveedor.telefono}`}
            >
              <div css={styles.contactIcon}>
                <Phone size={14} />
              </div>
              <span css={styles.contactText}>{proveedor.telefono}</span>
            </div>
          )}
          {proveedor.email && (
            <div
              css={styles.contactItem}
              title={`Email: ${proveedor.email}`}
            >
              <div css={styles.contactIcon}>
                <Mail size={14} />
              </div>
              <span css={styles.contactText}>{proveedor.email}</span>
            </div>
          )}
          {proveedor.direccion && (
            <div
              css={styles.contactItem}
              title={`Dirección: ${proveedor.direccion}`}
            >
              <div css={styles.contactIcon}>
                <MapPin size={14} />
              </div>
              <span css={styles.contactText}>{proveedor.direccion}</span>
            </div>
          )}
          {!formattedCuit && !proveedor.telefono && !proveedor.email && !proveedor.direccion && (
            <div css={styles.noContactText}>Sin datos de contacto adicionales</div>
          )}
        </div>

        {/* Mobile actions (only rendered in expanded mobile view) */}
        <div css={styles.mobileActions}>
          {proveedor.telefono && (
            <IconButton
              icon={<MessageCircle size={18} color="#25D366" />}
              title="WhatsApp"
              onClick={handleWhatsapp}
              data-testid={`proveedor-mobile-whatsapp-${proveedor.id}`}
            />
          )}
          <Can permission={Permission.ProveedoresEdit}>
            <IconButton
              icon={<Pencil size={18} />}
              title="Editar"
              onClick={handleEdit}
              data-testid={`proveedor-mobile-edit-${proveedor.id}`}
            />
            <IconButton
              icon={<Trash2 size={18} color={COLOR.SEMANTIC.DANGER} />}
              title="Eliminar"
              onClick={handleDelete}
              data-testid={`proveedor-mobile-delete-${proveedor.id}`}
            />
          </Can>
        </div>
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
    gap: 14,
    minWidth: 0,
    flexShrink: 0,
    width: 270,
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
    width: 44,
    height: 44,
    borderRadius: 10,
    background: COLOR.STATUS.INFO.BG_SUBTLE,
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      width: 40,
      height: 40,
      fontSize: 14,
    },
  }),
  identityText: css({
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  }),
  nameRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  }),
  name: css({
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 15,
    },
  }),
  statusSection: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexShrink: 0,
    order: 3,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      order: 2,
      gap: 6,
    },
  }),
  balanceBlock: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
  }),
  debtAmount: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.SEMANTIC.DANGER,
    lineHeight: 1,
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 14,
      marginBottom: 3,
    },
  }),
  cleanAmount: css({
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.SEMANTIC.INFO,
    lineHeight: 1,
    marginBottom: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      fontSize: 14,
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
  desktopActions: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingLeft: 12,
    marginLeft: 4,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  dataSection: css({
    flex: 1,
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    padding: "0 16px",
    borderLeft: `1px solid ${COLOR.BORDER.SUBTLE}`,
    order: 2,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      borderLeft: "none",
      flexDirection: "column",
      alignItems: "stretch",
      width: "100%",
      overflow: "hidden",
      transition:
        "max-height 240ms ease, opacity 200ms ease, transform 200ms ease, margin-top 240ms ease, padding-top 240ms ease",
      transformOrigin: "top",
      padding: 0,
    },
  }),
  dataSectionOpenMobile: css({
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      maxHeight: 600,
      opacity: 1,
      transform: "translateY(0)",
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    },
  }),
  dataSectionClosedMobile: css({
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
  contactDetails: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    columnGap: 20,
    rowGap: 8,
    minWidth: 0,
    flex: 1,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 8,
    },
  }),
  contactItem: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    minWidth: 0,
  }),
  contactIcon: css({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    color: COLOR.ICON.MUTED,
  }),
  contactText: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  }),
  noContactText: css({
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    fontStyle: "italic",
    gridColumn: "1 / -1",
  }),
  mobileActions: css({
    display: "none",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 8,
      paddingTop: 8,
      borderTop: `1px dashed ${COLOR.BORDER.SUBTLE}`,
    },
  }),
} as const;
