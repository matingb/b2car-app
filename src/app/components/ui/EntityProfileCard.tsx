"use client";

import React from "react";
import { css } from "@emotion/react";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { resolveClienteSaldo } from "@/lib/clienteSaldo";
import { formatTelephoneNumber } from "@/lib/telefono";
import { openWhatsapp } from "@/lib/whatsapp";
import Card from "@/app/components/ui/Card";
import Can from "@/app/components/auth/Can";
import IconButton from "@/app/components/ui/IconButton";
import WhatsAppIcon from "@/app/components/ui/WhatsAppIcon";
import type { PermissionValue } from "@/lib/permissions";

export type EntityContactItem = {
  icon?: React.ReactNode;
  label?: string;
  value: React.ReactNode;
  href?: string;
  title?: string;
};

export type EntityProfileCardProps = {
  title: string;
  avatarInitials?: string;
  fallbackInitials?: string;
  icon?: React.ReactNode;
  badgeText?: string;
  badge?: React.ReactNode;
  address?: string | null;
  emptyAddressText?: string;

  // Financial status
  showFinanzas?: boolean;
  finanzasPermission?: PermissionValue;
  loadingFinanzas?: boolean;
  saldo?: number | null;
  formattedBalance?: string;
  deudaBadgeText?: string;
  saldoFavorBadgeText?: string;
  alDiaBadgeText?: string;

  // Actions
  whatsappPhone?: string | null;
  whatsappMessage?: string;
  onEdit?: () => void;
  editTestId?: string;
  editLabel?: string;
  editPermission?: PermissionValue;
  onDelete?: () => void;
  deleteTestId?: string;
  deleteLabel?: string;
  deletePermission?: PermissionValue;
  extraActions?: React.ReactNode;

  // Contact details
  detailsTitle?: string;
  email?: string | null;
  telefono?: string | null;
  telefonoFormatted?: string | null;
  documentoLabel?: string | null;
  documentoValor?: string | null;
  showEmptyDocumento?: boolean;
  extraContactItems?: React.ReactNode;

  // Container props
  onClick?: () => void;
  style?: React.CSSProperties;

  // Children sections (e.g. Representantes)
  children?: React.ReactNode;
};

export function getEntityInitials(name?: string | null, fallback = "??"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function EntityProfileCard({
  title,
  avatarInitials,
  fallbackInitials = "??",
  icon,
  badgeText,
  badge,
  address,
  emptyAddressText = "Sin dirección registrada",

  showFinanzas = true,
  finanzasPermission,
  loadingFinanzas = false,
  saldo,
  formattedBalance,
  deudaBadgeText = "Deuda pendiente",
  saldoFavorBadgeText = "Saldo a favor",
  alDiaBadgeText = "Al día",

  whatsappPhone,
  whatsappMessage,
  onEdit,
  editTestId,
  editLabel = "Editar",
  editPermission,
  onDelete,
  deleteTestId,
  deleteLabel = "Eliminar",
  deletePermission,
  extraActions,

  detailsTitle = "DATOS DE CONTACTO Y FISCALES",
  email,
  telefono,
  telefonoFormatted,
  documentoLabel,
  documentoValor,
  showEmptyDocumento = false,
  extraContactItems,

  onClick,
  style,

  children,
}: EntityProfileCardProps) {
  const initials = avatarInitials || getEntityInitials(title, fallbackInitials);

  const saldoInfo = resolveClienteSaldo(saldo);
  const tieneDeuda = saldoInfo.tieneDeuda;
  const tieneSaldoAFavor = saldoInfo.tieneSaldoAFavor;
  const displayAmount = loadingFinanzas
    ? "..."
    : (formattedBalance ?? saldoInfo.formattedMonto);

  const financialBadge = tieneDeuda ? (
    <span css={styles.deudaBadge}>{deudaBadgeText}</span>
  ) : tieneSaldoAFavor ? (
    <span css={styles.saldoFavorBadge}>{saldoFavorBadgeText}</span>
  ) : (
    <span css={styles.alDiaBadge}>{alDiaBadgeText}</span>
  );

  const financialContent = showFinanzas ? (
    <div css={styles.financialSection}>
      <div css={styles.balanceRow}>
        <span
          css={[
            styles.balanceAmount,
            tieneDeuda
              ? styles.balanceDanger
              : tieneSaldoAFavor
                ? styles.balanceFavor
                : styles.balanceClean,
          ]}
        >
          {displayAmount}
        </span>
        {financialBadge}
      </div>
    </div>
  ) : null;

  const financialSection =
    finanzasPermission && financialContent ? (
      <Can permission={finanzasPermission}>{financialContent}</Can>
    ) : (
      financialContent
    );

  const whatsappButton = whatsappPhone ? (
    <IconButton
      icon={<WhatsAppIcon size={18} />}
      size={18}
      onClick={(e) => {
        e.stopPropagation();
        openWhatsapp(
          whatsappPhone,
          whatsappMessage ?? `Hola ${title}, me comunico desde el taller.`
        );
      }}
      tooltip="Contactar por WhatsApp"
      ariaLabel="WhatsApp"
      hoverColor={COLOR.SEMANTIC.SUCCESS}
    />
  ) : null;

  const editButton = onEdit ? (
    <IconButton
      icon={<Pencil size={18} />}
      size={18}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      tooltip={editLabel}
      ariaLabel={editLabel}
      hoverColor={COLOR.ACCENT.PRIMARY}
      data-testid={editTestId}
    />
  ) : null;

  const editAction =
    editPermission && editButton ? (
      <Can permission={editPermission}>{editButton}</Can>
    ) : (
      editButton
    );

  const deleteButton = onDelete ? (
    <IconButton
      icon={<Trash2 size={18} />}
      size={18}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      tooltip={deleteLabel}
      ariaLabel={deleteLabel}
      hoverColor={COLOR.SEMANTIC.DANGER}
      data-testid={deleteTestId}
    />
  ) : null;

  const deleteAction =
    deletePermission && deleteButton ? (
      <Can permission={deletePermission}>{deleteButton}</Can>
    ) : (
      deleteButton
    );

  const resolvedPhoneDisplay =
    telefonoFormatted ?? (telefono ? formatTelephoneNumber(undefined, telefono) : null);

  return (
    <Card css={styles.cardContainer} onClick={onClick} style={style}>
      {/* FILA SUPERIOR: Identidad y Finanzas */}
      <div css={styles.headerRow}>
        <div css={styles.identitySection}>
          <div css={styles.avatarSquircle}>{initials}</div>

          <div css={styles.titlesSection}>
            <div css={styles.nameRow}>
              {icon && <span css={styles.nameIconWrapper}>{icon}</span>}
              <h1 css={styles.entityTitle}>{title}</h1>
              {badgeText && <span css={styles.entityBadge}>{badgeText}</span>}
              {badge}
            </div>

            <div css={styles.addressRow}>
              <MapPin size={15} color={COLOR.TEXT.SECONDARY} />
              <span>{address || emptyAddressText}</span>
            </div>
          </div>
        </div>

        {financialSection}
      </div>

      {/* FILA INFERIOR: Datos de Contacto y Acciones */}
      <div css={styles.detailsSection}>
        <div css={styles.detailsHeader}>
          <span css={styles.detailsTitle}>{detailsTitle}</span>
        </div>

        <div css={styles.contactList}>
          {email !== undefined && (
            <div css={styles.contactItem}>
              <Mail size={16} color={COLOR.TEXT.SECONDARY} />
              {email ? (
                <a
                  href={`mailto:${email}`}
                  onClick={(e) => e.stopPropagation()}
                  css={styles.contactLink}
                  title="Enviar correo"
                >
                  {email}
                </a>
              ) : (
                <span css={styles.mutedText}>—</span>
              )}
            </div>
          )}

          {telefono !== undefined && (
            <div css={styles.contactItem}>
              <Phone size={16} color={COLOR.TEXT.SECONDARY} />
              {telefono ? (
                <a
                  href={`tel:${telefono}`}
                  onClick={(e) => e.stopPropagation()}
                  css={styles.contactLink}
                  title="Llamar"
                >
                  {resolvedPhoneDisplay}
                </a>
              ) : (
                <span css={styles.mutedText}>—</span>
              )}
            </div>
          )}

          {documentoLabel && (documentoValor || showEmptyDocumento) && (
            <div css={styles.contactItem}>
              <span css={styles.fieldLabel}>
                {documentoLabel.endsWith(":") ? documentoLabel : `${documentoLabel}:`}
              </span>
              <span>{documentoValor || "—"}</span>
            </div>
          )}

          {extraContactItems}
        </div>

        <div css={styles.actionsGroup}>
          {whatsappButton}
          {editAction}
          {deleteAction}
          {extraActions}
        </div>
      </div>

      {children}
    </Card>
  );
}

const styles = {
  cardContainer: css({
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: "24px 28px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      padding: "20px 20px",
    },
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "16px 16px",
    },
  }),
  headerRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    paddingBottom: 20,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  identitySection: css({
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 260,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      minWidth: 0,
      gap: 0,
    },
  }),
  avatarSquircle: css({
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "0.04em",
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  nameIconWrapper: css({
    display: "inline-flex",
    alignItems: "center",
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      display: "none",
    },
  }),
  titlesSection: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
  }),
  nameRow: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  }),
  entityTitle: css({
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.2,
  }),
  entityBadge: css({
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 4,
    padding: "2px 8px",
    display: "inline-block",
  }),
  addressRow: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  }),
  financialSection: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      alignItems: "flex-start",
      width: "100%",
      marginTop: 8,
    },
  }),
  balanceRow: css({
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  }),
  balanceAmount: css({
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  }),
  balanceDanger: css({
    color: COLOR.SEMANTIC.DANGER,
  }),
  balanceClean: css({
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  balanceFavor: css({
    color: COLOR.SEMANTIC.INFO,
  }),
  deudaBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.DANGER,
    backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 9999,
    padding: "4px 12px",
  }),
  alDiaBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.SUCCESS,
    backgroundColor: COLOR.BACKGROUND.SUCCESS_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 9999,
    padding: "4px 12px",
  }),
  saldoFavorBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.SEMANTIC.INFO,
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 9999,
    padding: "4px 12px",
  }),
  detailsSection: css({
    marginTop: 18,
    display: "grid",
    gridTemplateAreas: `
      "title actions"
      "contacts contacts"
    `,
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    rowGap: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateAreas: `
        "title"
        "contacts"
        "actions"
      `,
      gridTemplateColumns: "1fr",
      rowGap: 12,
    },
  }),
  detailsHeader: css({
    gridArea: "title",
    display: "flex",
    alignItems: "center",
  }),
  detailsTitle: css({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: COLOR.TEXT.PRIMARY,
    textTransform: "uppercase",
  }),
  actionsGroup: css({
    gridArea: "actions",
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifySelf: "end",
    marginRight: -8,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      justifySelf: "start",
      marginLeft: -8,
      marginRight: 0,
      marginTop: 4,
    },
  }),
  contactList: css({
    gridArea: "contacts",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px 32px",
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 12,
    },
  }),
  contactItem: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  contactLink: css({
    color: COLOR.TEXT.PRIMARY,
    textDecoration: "none",
    transition: "color 150ms ease",
    "&:hover": {
      color: COLOR.ACCENT.PRIMARY,
      textDecoration: "underline",
    },
  }),
  fieldLabel: css({
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.04em",
    color: COLOR.TEXT.PRIMARY,
    textTransform: "uppercase",
  }),
  mutedText: css({
    color: COLOR.TEXT.SECONDARY,
  }),
};
