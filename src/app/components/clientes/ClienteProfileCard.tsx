"use client";

import React from "react";
import { css } from "@emotion/react";
import {
  Building2,
  Plus,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { COLOR } from "@/theme/theme";
import { formatTelephoneNumber } from "@/lib/telefono";
import type { ClienteResumenFinanciero, Representante, TipoCliente } from "@/model/types";
import EntityProfileCard from "@/app/components/ui/EntityProfileCard";
import { Permission } from "@/lib/permissions";

type Props = {
  tipo: TipoCliente;
  nombre: string;
  direccion?: string | null;
  email?: string | null;
  telefono?: string | null;
  codigo_pais?: string | null;
  cuit?: string | null;
  dniCuil?: string | null;
  resumenFinanciero: ClienteResumenFinanciero | null;
  loadingFinanzas?: boolean;
  onEditCliente: () => void;
  representantes?: Representante[];
  onAddRepresentante?: () => void;
  onDeleteRepresentante?: (id: string) => void;
};

export default function ClienteProfileCard({
  tipo,
  nombre,
  direccion,
  email,
  telefono,
  codigo_pais,
  cuit,
  dniCuil,
  resumenFinanciero,
  loadingFinanzas = false,
  onEditCliente,
  representantes = [],
  onAddRepresentante,
  onDeleteRepresentante,
}: Props) {
  const isEmpresa = tipo === "empresa";
  const formattedPhone = formatTelephoneNumber(codigo_pais ?? undefined, telefono ?? "");

  return (
    <EntityProfileCard
      title={nombre}
      icon={
        isEmpresa ? (
          <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
        ) : (
          <UserIcon size={20} color={COLOR.ACCENT.PRIMARY} />
        )
      }
      address={direccion}
      finanzasPermission={Permission.ClientesFinanzasView}
      saldo={resumenFinanciero?.saldo_cuenta}
      loadingFinanzas={loadingFinanzas}
      email={email}
      telefono={telefono}
      telefonoFormatted={formattedPhone}
      documentoLabel={cuit ? "CUIT" : dniCuil ? "DNI/CUIL" : undefined}
      documentoValor={cuit || dniCuil}
      whatsappPhone={telefono}
      whatsappMessage={`Hola ${nombre}, me comunico desde el taller.`}
      onEdit={onEditCliente}
      editTestId="cliente-detail-edit"
      detailsTitle={isEmpresa ? "DATOS DE CONTACTO Y FISCALES" : "DATOS DE CONTACTO"}
    >
      {isEmpresa && (
        <div css={styles.representantesSection}>
          <div css={styles.detailsHeader}>
            <span css={styles.detailsTitle}>REPRESENTANTES</span>
            {onAddRepresentante && (
              <button
                type="button"
                onClick={onAddRepresentante}
                css={styles.textActionButton}
              >
                <Plus size={14} />
                <span>Añadir</span>
              </button>
            )}
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
                  {onDeleteRepresentante && (
                    <button
                      type="button"
                      onClick={() => onDeleteRepresentante(rep.id)}
                      css={styles.deleteIconButton}
                      title="Eliminar representante"
                      aria-label="Eliminar representante"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </EntityProfileCard>
  );
}

const styles = {
  representantesSection: css({
    marginTop: 20,
    paddingTop: 18,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
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
  representantesList: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
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
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
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
