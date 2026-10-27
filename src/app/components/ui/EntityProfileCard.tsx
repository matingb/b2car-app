"use client";

import React from "react";
import { css } from "@emotion/react";
import {
  Mail,
  MapPin,
  MessageCircle,
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

  children,
}: EntityProfileCardProps) {
  const initials = avatarInitials || getEntityInitials(title, fallbackInitials);

  const saldoInfo = resolveClienteSaldo(saldo);
  const tieneDeuda = saldoInfo.tieneDeuda;
  const tieneSaldoAFavor = saldoInfo.tieneSaldoAFavor;
  const displayAmount = loadingFinanzas
    ? "..."
    : (formattedBalance ?? saldoInfo.formattedMonto);

  const badge = tieneDeuda ? (
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
        {badge}
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
    <button
      type="button"
      onClick={() =>
        openWhatsapp(
          whatsappPhone,
          whatsappMessage ?? `Hola ${title}, me comunico desde el taller.`
        )
      }
      css={styles.whatsappActionButton}
      title="Contactar por WhatsApp"
    >
      <MessageCircle size={14} color={COLOR.SEMANTIC.SUCCESS} />
      <span>WhatsApp</span>
    </button>
  ) : null;

  const editButton = onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      css={styles.textActionButton}
      data-testid={editTestId}
    >
      <Pencil size={14} />
      <span>{editLabel}</span>
    </button>
  ) : null;

  const editAction =
    editPermission && editButton ? (
      <Can permission={editPermission}>{editButton}</Can>
    ) : (
      editButton
    );

  const deleteButton = onDelete ? (
    <button
      type="button"
      onClick={onDelete}
      css={styles.deleteActionButton}
      data-testid={deleteTestId}
    >
      <Trash2 size={14} />
      <span>{deleteLabel}</span>
    </button>
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
    <Card css={styles.cardContainer}>
      {/* FILA SUPERIOR: Identidad y Finanzas */}
      <div css={styles.headerRow}>
        <div css={styles.identitySection}>
          <div css={styles.avatarSquircle}>{initials}</div>

          <div css={styles.titlesSection}>
            <div css={styles.nameRow}>
              {icon}
              <h1 css={styles.entityTitle}>{title}</h1>
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

          <div css={styles.actionsGroup}>
            {whatsappButton}
            {editAction}
            {deleteAction}
            {extraActions}
          </div>
        </div>

        <div css={styles.contactList}>
          {email !== undefined && (
            <div css={styles.contactItem}>
              <Mail size={16} color={COLOR.TEXT.SECONDARY} />
              {email ? (
                <a
                  href={`mailto:${email}`}
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
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  detailsHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  }),
  detailsTitle: css({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: COLOR.TEXT.PRIMARY,
    textTransform: "uppercase",
  }),
  actionsGroup: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
  }),
  textActionButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "none",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "background 150ms ease",
    "&:hover": {
      backgroundColor: "rgba(15, 118, 110, 0.08)",
    },
  }),
  whatsappActionButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "none",
    color: COLOR.SEMANTIC.SUCCESS,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "background 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.STATUS.SUCCESS.BG_SUBTLE,
    },
  }),
  deleteActionButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "none",
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "background 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.STATUS.DANGER.BG_SUBTLE,
    },
  }),
  contactList: css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px 32px",
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
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
