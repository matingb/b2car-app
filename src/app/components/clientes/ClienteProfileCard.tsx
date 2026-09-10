"use client";

import React from "react";
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  User as UserIcon,
  Trash2,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { formatTelephoneNumber } from "@/lib/telefono";
import type { ClienteResumenFinanciero, Representante, TipoCliente } from "@/model/types";
import { css } from "@emotion/react";
import Card from "../ui/Card";

type Props = {
  tipo: TipoCliente;
  nombre: string;
  direccion?: string | null;
  email?: string | null;
  telefono?: string | null;
  codigo_pais?: string | null;
  cuit?: string | null;
  numero_documento?: string | null;
  resumenFinanciero: ClienteResumenFinanciero | null;
  loadingFinanzas?: boolean;
  onEditCliente: () => void;
  representantes?: Representante[];
  onAddRepresentante?: () => void;
  onDeleteRepresentante?: (id: string) => void;
};

function getInitials(name: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ClienteProfileCard({
  tipo,
  nombre,
  direccion,
  email,
  telefono,
  codigo_pais,
  cuit,
  numero_documento,
  resumenFinanciero,
  loadingFinanzas,
  onEditCliente,
  representantes = [],
  onAddRepresentante,
  onDeleteRepresentante,
}: Props) {
  const isEmpresa = tipo === "empresa";
  const saldoCuenta = resumenFinanciero?.saldo_cuenta ?? 0;
  const tieneDeuda = saldoCuenta > 0;
  const tieneSaldoAFavor = saldoCuenta < 0;
  const saldoVisible = Math.abs(saldoCuenta);

  return (
    <Card style={styles.cardContainer}>
      {/* HEADER ROW */}
      <div css={styles.headerRow}>
        {/* Left: Avatar + Name + Address */}
        <div css={styles.clientIdentity}>
          <div css={styles.avatarCircle}>
            {getInitials(nombre)}
          </div>
          <div css={styles.clientTitles}>
            <div css={styles.nameRow}>
              {isEmpresa ? (
                <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
              ) : (
                <UserIcon size={20} color={COLOR.ACCENT.PRIMARY} />
              )}
              <h1 css={styles.clientName}>{nombre}</h1>
            </div>
            {direccion ? (
              <div css={styles.addressRow}>
                <MapPin size={15} color={COLOR.TEXT.SECONDARY} />
                <span>{direccion}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Financial Balance & Badges */}
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
              <span css={styles.alDiaBadge}>Al día</span>
            )}
          </div>
        </div>
      </div>

      {/* BODY 2 COLUMNS */}
      <div css={styles.bodyGrid}>
        {/* Column 1: Datos de Contacto */}
        <div css={styles.columnBlock}>
          <div css={styles.columnHeader}>
            <span css={styles.columnTitle}>DATOS DE CONTACTO</span>
            <button
              type="button"
              onClick={onEditCliente}
              css={styles.textActionButton}
            >
              <Pencil size={14} />
              <span>Editar</span>
            </button>
          </div>

          <div css={styles.contactList}>
            <div css={styles.contactItem}>
              <Mail size={18} color={COLOR.ACCENT.PRIMARY} />
              <span>{email || "-"}</span>
            </div>

            <div css={styles.contactItem}>
              <Phone size={18} color={COLOR.ACCENT.PRIMARY} />
              <span>{formatTelephoneNumber(codigo_pais ?? undefined, telefono ?? "") || "-"}</span>
            </div>

            {cuit ? (
              <div css={styles.contactItem}>
                <span css={styles.docIcon}>CUIT:</span>
                <span>{cuit}</span>
              </div>
            ) : numero_documento ? (
              <div css={styles.contactItem}>
                <span css={styles.docIcon}>DOC:</span>
                <span>{numero_documento}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Column 2: Representantes */}
        {isEmpresa && (
          <div css={styles.columnBlock}>
            <div css={styles.columnHeader}>
              <span css={styles.columnTitle}>REPRESENTANTES</span>
              {onAddRepresentante ? (
                <button
                  type="button"
                  onClick={onAddRepresentante}
                  css={styles.textActionButton}
                >
                  <Plus size={14} />
                  <span>Añadir</span>
                </button>
              ) : null}
            </div>

            <div css={styles.representantesList}>
              {representantes.length === 0 ? (
                <div css={styles.emptyText}>Sin representantes registrados</div>
              ) : (
                representantes.map((rep) => (
                  <div key={rep.id} css={styles.repCard}>
                    <div css={styles.repLeft}>
                      <div css={styles.repAvatar}>
                        {(rep.nombre || "R")[0].toUpperCase()}
                      </div>
                      <div css={styles.repInfo}>
                        <div css={styles.repName}>
                          {`${rep.nombre} ${rep.apellido || ""}`.trim()}
                        </div>
                        <div css={styles.repPhone}>
                          {formatTelephoneNumber(rep.codigo_pais ?? undefined, rep.telefono ?? "")}
                        </div>
                      </div>
                    </div>
                    {onDeleteRepresentante ? (
                      <button
                        type="button"
                        onClick={() => onDeleteRepresentante(rep.id)}
                        css={styles.deleteIconButton}
                        title="Eliminar representante"
                        aria-label="Eliminar representante"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const styles = {
  cardContainer: {
    marginTop: "20px",
    marginBottom: "20px",
    //backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 16,
    padding: "24px 28px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      padding: "16px 16px",
    },
  },
  headerRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    paddingBottom: 24,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  clientIdentity: css({
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 260,
  }),
  avatarCircle: css({
    width: 62,
    height: 62,
    borderRadius: "50%",
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "0.05em",
    flexShrink: 0,
  }),
  clientTitles: css({
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }),
  nameRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  clientName: css({
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.2,
  }),
  addressRow: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
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
    },
  }),
  balanceRow: css({
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap"
  }),
  balanceLabel: css({
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
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
    color: "#2563eb",
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
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 9999,
    padding: "4px 12px",
  }),
  bodyGrid: css({
    display: "flex",
    gap: 32,
    marginTop: 22,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "column",
      gap: 20,
    },
  }),
  columnBlock: css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  columnHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
  }),
  columnTitle: css({
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: COLOR.TEXT.PRIMARY,
    textTransform: "uppercase",
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
    padding: "4px 6px",
    borderRadius: 6,
    transition: "background 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    },
  }),
  contactList: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  contactItem: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  }),
  docIcon: css({
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
    minWidth: 42,
  }),
  representantesList: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  repCard: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  }),
  repLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
  }),
  repAvatar: css({
    width: 38,
    height: 38,
    borderRadius: "50%",
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  }),
  repInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  repName: css({
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLOR.TEXT.PRIMARY,
  }),
  repPhone: css({
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  }),
  deleteIconButton: css({
    background: "transparent",
    border: "none",
    color: COLOR.TEXT.TERTIARY,
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 150ms ease, background 150ms ease",
    "&:hover": {
      color: COLOR.SEMANTIC.DANGER,
      backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    },
  }),
  emptyText: css({
    fontSize: 13,
    color: COLOR.TEXT.TERTIARY,
    fontStyle: "italic",
    padding: "8px 0",
  }),
};
