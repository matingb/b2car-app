"use client";

import React from "react";
import { css } from "@emotion/react";
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { formatTelephoneNumber } from "@/lib/telefono";
import { openWhatsapp } from "@/lib/whatsapp";
import type { Proveedor } from "@/model/types";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";
import Card from "@/app/components/ui/Card";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

export type ProveedorProfileCardProps = {
  proveedor: Proveedor;
  resumenCuentaCorriente: ProveedorCuentaCorrienteResumen | null;
  loadingFinanzas?: boolean;
  onEditProveedor: () => void;
  onDeleteProveedor?: () => void;
  rubro?: string | null;
  condicionPago?: string | null;
};

function getInitials(name: string): string {
  if (!name) return "PR";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ProveedorProfileCard({
  proveedor,
  resumenCuentaCorriente,
  loadingFinanzas = false,
  onEditProveedor,
  onDeleteProveedor,
}: ProveedorProfileCardProps) {
  const saldoAdeudado = resumenCuentaCorriente?.saldoAdeudado ?? 0;
  const tieneDeuda = saldoAdeudado > 0;
  const tieneSaldoAFavor = saldoAdeudado < 0;
  const saldoVisible = Math.abs(saldoAdeudado);
  const initials = getInitials(proveedor.nombre);

  return (
    <Card css={styles.cardContainer}>
      <div css={styles.headerRow}>
        <div css={styles.identitySection}>
          <div css={styles.avatarSquircle}>{initials}</div>

          <div css={styles.titlesSection}>
            <div css={styles.nameRow}>
              <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
              <h1 css={styles.supplierName}>{proveedor.nombre}</h1>
            </div>

            <div css={styles.addressRow}>
              <MapPin size={15} color={COLOR.TEXT.SECONDARY} />
              <span>{proveedor.direccion || "Sin dirección registrada"}</span>
            </div>
          </div>
        </div>

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
              {loadingFinanzas
                ? "..."
                : formatArs(saldoVisible, { maxDecimals: 0, minDecimals: 0 })}
            </span>

            {tieneDeuda ? (
              <span css={styles.deudaBadge}>Deuda pendiente</span>
            ) : tieneSaldoAFavor ? (
              <span css={styles.saldoFavorBadge}>Saldo a favor</span>
            ) : (
              <span css={styles.alDiaBadge}>
                <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                Al día
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FILA INFERIOR: Datos de Contacto y Fiscales */}
      <div css={styles.detailsSection}>
        <div css={styles.detailsHeader}>
          <span css={styles.detailsTitle}>DATOS DE CONTACTO Y FISCALES</span>

          <div css={styles.actionsGroup}>
            {proveedor.telefono && (
              <button
                type="button"
                onClick={() =>
                  openWhatsapp(
                    proveedor.telefono!,
                    `Hola ${proveedor.nombre}, me comunico desde el taller.`
                  )
                }
                css={styles.whatsappActionButton}
                title="Contactar por WhatsApp"
              >
                <MessageCircle size={14} color="#25D366" />
                <span>WhatsApp</span>
              </button>
            )}

            <Can permission={Permission.ProveedoresEdit}>
              <button
                type="button"
                onClick={onEditProveedor}
                css={styles.textActionButton}
                data-testid="proveedor-detail-edit"
              >
                <Pencil size={14} />
                <span>Editar</span>
              </button>

              {onDeleteProveedor && (
                <button
                  type="button"
                  onClick={onDeleteProveedor}
                  css={styles.deleteActionButton}
                  data-testid="proveedor-detail-delete"
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              )}
            </Can>
          </div>
        </div>

        <div css={styles.contactList}>
          {/* Email */}
          <div css={styles.contactItem}>
            <Mail size={16} color={COLOR.TEXT.SECONDARY} />
            {proveedor.email ? (
              <a
                href={`mailto:${proveedor.email}`}
                css={styles.contactLink}
                title="Enviar correo"
              >
                {proveedor.email}
              </a>
            ) : (
              <span css={styles.mutedText}>—</span>
            )}
          </div>

          {/* Teléfono */}
          <div css={styles.contactItem}>
            <Phone size={16} color={COLOR.TEXT.SECONDARY} />
            {proveedor.telefono ? (
              <a
                href={`tel:${proveedor.telefono}`}
                css={styles.contactLink}
                title="Llamar"
              >
                {formatTelephoneNumber(undefined, proveedor.telefono)}
              </a>
            ) : (
              <span css={styles.mutedText}>—</span>
            )}
          </div>

          {/* CUIT */}
          <div css={styles.contactItem}>
            <span css={styles.fieldLabel}>CUIT:</span>
            <span>{proveedor.cuit || "—"}</span>
          </div>
        </div>
      </div>
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
  supplierName: css({
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.2,
  }),
  rubroBadge: css({
    fontSize: 12,
    fontWeight: 500,
    padding: "2px 10px",
    borderRadius: 9999,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
    gap: 4,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      alignItems: "flex-start",
      width: "100%",
      marginTop: 8,
    },
  }),
  balanceRow: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  }),
  balanceAmount: css({
    fontSize: 28,
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
  balanceLabel: css({
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase",
  }),
  alDiaBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.STATUS.SUCCESS.TEXT,
    backgroundColor: COLOR.STATUS.SUCCESS.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.SUCCESS.BORDER}`,
    borderRadius: 9999,
    padding: "4px 10px",
  }),
  deudaBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.STATUS.DANGER.TEXT,
    backgroundColor: COLOR.STATUS.DANGER.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.DANGER.BORDER}`,
    borderRadius: 9999,
    padding: "4px 10px",
  }),
  saldoFavorBadge: css({
    display: "inline-flex",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.STATUS.INFO.TEXT,
    backgroundColor: COLOR.STATUS.INFO.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.INFO.BORDER}`,
    borderRadius: 9999,
    padding: "4px 10px",
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
    color: "#25D366",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "background 150ms ease",
    "&:hover": {
      backgroundColor: "rgba(37, 211, 102, 0.1)",
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
  conditionText: css({
    color: COLOR.TEXT.SECONDARY,
    maxWidth: 280,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  mutedText: css({
    color: COLOR.TEXT.SECONDARY,
  }),
};
