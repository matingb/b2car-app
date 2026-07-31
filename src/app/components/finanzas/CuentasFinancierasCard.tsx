"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import {
  CreditCard,
  Landmark,
  MoreHorizontal,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";
import { formatMoney, getCuentaTipoLabel } from "./finanzasUtils";

type Props = {
  nombre: string;
  tipo: string;
  saldo: number | null | undefined;
  activo: boolean;
  onClick?: () => void;
};

function CuentaIcon({ tipo }: { tipo: string }) {
  const iconProps = { size: 21 };
  switch (tipo.toUpperCase()) {
    case "CUENTA_BANCARIA":
      return <Landmark {...iconProps} />;
    case "BILLETERA_DIGITAL":
      return <WalletCards {...iconProps} />;
    case "TARJETA_CREDITO":
      return <CreditCard {...iconProps} />;
    case "EFECTIVO":
      return <CircleDollarSign {...iconProps} />;
    default:
      return <MoreHorizontal {...iconProps} />;
  }
}

export default function CuentasFinancierasCard({
  nombre,
  tipo,
  saldo,
  activo,
  onClick,
}: Props) {
  const saldoNumber = Number(saldo) || 0;
  const saldoColor = saldoNumber < 0 ? COLOR.ICON.DANGER : COLOR.TEXT.PRIMARY;

  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onClick();
      }}
      aria-label={onClick ? `Ver cuenta ${nombre}` : undefined}
      style={{
        ...styles.card,
        ...(activo ? null : styles.inactiveCard),
      }}
    >
      <div style={styles.topRow}>
        <div style={styles.accountHeading}>
          <div
            style={{
              ...styles.iconWrap,
              ...(activo ? null : styles.inactiveIconWrap),
            }}
          >
            <CuentaIcon tipo={tipo} />
          </div>
          <div style={styles.accountText}>
            <div style={styles.name}>{nombre}</div>
            <div style={styles.type}>{getCuentaTipoLabel(tipo)}</div>
          </div>
        </div>
        <span
          style={{
            ...styles.status,
            ...(activo ? styles.activeStatus : styles.inactiveStatus),
          }}
        >
          {activo ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div style={styles.balanceBlock}>
        <span style={styles.balanceLabel}>Saldo actual</span>
        <strong style={{ ...styles.balance, color: saldoColor }}>
          {formatMoney(saldoNumber)}
        </strong>
      </div>
    </Card>
  );
}

const styles = {
  card: {
    minHeight: 152,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    gap: 24,
  },
  inactiveCard: {
    opacity: 0.72,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  accountHeading: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 12,
    color: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  inactiveIconWrap: {
    color: COLOR.TEXT.TERTIARY,
    background: COLOR.BACKGROUND.DISABLED_TINT,
  },
  accountText: { minWidth: 0 },
  name: {
    fontSize: 16,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  type: {
    marginTop: 3,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  status: {
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  activeStatus: {
    color: COLOR.SEMANTIC.SUCCESS,
    background: COLOR.BACKGROUND.SUCCESS_TINT,
  },
  inactiveStatus: {
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.DISABLED_TINT,
  },
  balanceBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
  },
  balanceLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  balance: {
    fontSize: 24,
    lineHeight: 1.2,
  },
} as const;
