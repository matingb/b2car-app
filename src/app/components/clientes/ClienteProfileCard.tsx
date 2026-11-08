"use client";

import React, { useState } from "react";
import { css } from "@emotion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Plus,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatTelephoneNumber } from "@/lib/telefono";
import type {
  ClienteResumenFinanciero,
  Representante,
  SentidoMovimientoCuentaCorriente,
  TipoCliente,
} from "@/model/types";
import EntityProfileCard from "@/app/components/ui/EntityProfileCard";
import MovimientoCuentaCorrienteModal from "@/app/components/finanzas/MovimientoCuentaCorrienteModal";
import Can from "@/app/components/auth/Can";
import IconButton from "@/app/components/ui/IconButton";
import Tooltip from "@/app/components/ui/Tooltip";
import { Permission } from "@/lib/permissions";

type Props = {
  clienteId?: string;
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
  onFinanzasUpdated?: () => void;
  representantes?: Representante[];
  onAddRepresentante?: () => void;
  onDeleteRepresentante?: (id: string) => void;
};

export default function ClienteProfileCard({
  clienteId,
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
  onFinanzasUpdated,
  representantes = [],
  onAddRepresentante,
  onDeleteRepresentante,
}: Props) {
  const [movimientoModalSentido, setMovimientoModalSentido] =
    useState<SentidoMovimientoCuentaCorriente | null>(null);
  const isEmpresa = tipo === "empresa";
  const formattedPhone = formatTelephoneNumber(codigo_pais ?? undefined, telefono ?? "");

  const registrarMovimientoAction = clienteId ? (
    <Can
      permission={Permission.ClientesFinanzasView}
      anyPermissions={[
        Permission.OperacionesEdit,
        Permission.FinanzasEdit,
        Permission.ArreglosCobrosRegister,
      ]}
    >
      <IconButton
        icon={<ArrowDownLeft size={18} />}
        size={18}
        onClick={(e) => {
          e.stopPropagation();
          setMovimientoModalSentido("COBRO");
        }}
        hoverColor={COLOR.SEMANTIC.SUCCESS}
        data-testid="cliente-detail-registrar-movimiento"
        tooltip="Registrar Cobro"
        ariaLabel="Registrar Cobro"
      />
      <IconButton
        icon={<ArrowUpRight size={18} />}
        size={18}
        onClick={(e) => {
          e.stopPropagation();
          setMovimientoModalSentido("PAGO");
        }}
        hoverColor={COLOR.ACCENT.PRIMARY}
        data-testid="cliente-detail-registrar-pago"
        tooltip="Registrar Pago"
        ariaLabel="Registrar Pago"
      />
    </Can>
  ) : null;

  return (
    <>
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
        extraActions={registrarMovimientoAction}
        detailsTitle={isEmpresa ? "DATOS DE CONTACTO Y FISCALES" : "DATOS DE CONTACTO"}
      >
        {isEmpresa && (
          <div css={styles.representantesSection}>
            <div css={styles.detailsHeader}>
              <span css={styles.detailsTitle}>REPRESENTANTES</span>
              {onAddRepresentante && (
                <IconButton
                  icon={<Plus size={18} />}
                  size={18}
                  onClick={onAddRepresentante}
                  tooltip="Añadir representante"
                  ariaLabel="Añadir"
                  hoverColor={COLOR.ACCENT.PRIMARY}
                />
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
                      <Tooltip content="Eliminar representante" placement="top">
                        <button
                          type="button"
                          onClick={() => onDeleteRepresentante(rep.id)}
                          css={styles.deleteIconButton}
                          title="Eliminar representante"
                          aria-label="Eliminar representante"
                        >
                          <Trash2 size={15} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </EntityProfileCard>

      {movimientoModalSentido && clienteId && (
        <MovimientoCuentaCorrienteModal
          open
          entidad="CLIENTE"
          contraparteId={clienteId}
          contraparteNombre={nombre}
          saldoActual={resumenFinanciero?.saldo_cuenta ?? 0}
          initialSentido={movimientoModalSentido}
          onClose={() => setMovimientoModalSentido(null)}
          onSuccess={() => {
            setMovimientoModalSentido(null);
            onFinanzasUpdated?.();
          }}
        />
      )}
    </>
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
  representantesList: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
    },
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
