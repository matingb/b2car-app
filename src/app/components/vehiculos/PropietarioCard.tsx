"use client";

import React from "react";
import { css } from "@emotion/react";
import { Building2, Pencil, User as UserIcon } from "lucide-react";
import { Cliente, TipoCliente } from "@/model/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatTelephoneNumber } from "@/lib/telefono";
import EntityProfileCard from "@/app/components/ui/EntityProfileCard";
import IconButton from "@/app/components/ui/IconButton";

type Props = {
  cliente: Cliente;
  onClick?: () => void; // navegar a detalle
  onReassign?: () => void; // abrir modal de reasignación
  style?: React.CSSProperties;
  className?: string;
};

export default function PropietarioCard({
  cliente,
  onClick,
  onReassign,
  style,
  className,
}: Props) {
  const isEmpresa = cliente.tipo_cliente === TipoCliente.EMPRESA;
  const formattedPhone = formatTelephoneNumber(cliente.codigo_pais, cliente.telefono ?? "");
  const documentoLabel = cliente.cuit ? "CUIT" : cliente.dni_cuil ? "DNI/CUIL" : undefined;
  const documentoValor = cliente.cuit || cliente.dni_cuil || undefined;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", ...style }} className={className}>
      <div style={styles.headerRow}>
        <h3 css={styles.title}>Propietario</h3>
        {onReassign && (
          <IconButton
            icon={<Pencil />}
            size={18}
            onClick={(e) => {
              e.stopPropagation();
              onReassign();
            }}
            title="Reasignar propietario"
            ariaLabel="Reasignar propietario"
          />
        )}
      </div>
      <EntityProfileCard
        title={cliente.nombre}
        badgeText={isEmpresa ? "Empresa" : "Particular"}
        icon={
          isEmpresa ? (
            <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
          ) : (
            <UserIcon size={20} color={COLOR.ACCENT.PRIMARY} />
          )
        }
        address={cliente.direccion}
        showFinanzas={false}
        email={cliente.email}
        telefono={cliente.telefono}
        telefonoFormatted={formattedPhone}
        documentoLabel={documentoLabel}
        documentoValor={documentoValor}
        whatsappPhone={cliente.telefono}
        whatsappMessage={`Hola ${cliente.nombre}, me comunico desde el taller.`}
        onEdit={onReassign}
        editLabel="Reasignar"
        editTestId="propietario-reassign"
        onClick={onClick}
        detailsTitle={isEmpresa ? "DATOS DE CONTACTO Y FISCALES" : "DATOS DE CONTACTO"}
        style={{ marginTop: 0, marginBottom: 0 }}
      />
    </div>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: css({
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 18,
    },
  }),
};