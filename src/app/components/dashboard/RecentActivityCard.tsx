"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { formatTimeAgo } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import { css } from "@emotion/react";

export type RecentActivity = {
  id: string;
  titulo: string;
  vehiculo: string;
  fechaUltimaActualizacion: string;
  monto: number;
};

export default function RecentActivityCard({ activity }: { activity: RecentActivity }) {
  const router = useRouter();

  const timeAgo = useMemo(
    () => formatTimeAgo(activity.fechaUltimaActualizacion),
    [activity.fechaUltimaActualizacion]
  );

  return (
    <Card
      onClick={() => router.push(`/arreglos/${activity.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div style={styles.row}>
        <div style={styles.left}>
          <div style={styles.iconCircle}>
            <Clock size={18} color={COLOR.ACCENT.PRIMARY} />
          </div>

          <div css={styles.text}>
            <div style={styles.title}>{activity.titulo}</div>
            <div style={styles.subtitle}>
              Vehículo: {activity.vehiculo} {" • "} {timeAgo}
            </div>
          </div>
        </div>

        <div style={styles.right}>
          <div style={styles.amount}>
            {formatArs(activity.monto, { maxDecimals: 2, minDecimals: 0 })}
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    background: "rgba(0, 121, 149, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: css({
    minWidth: 0,
    maxWidth: '800px',
    [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
      maxWidth: '550px',
    },
    flex: 1,
  }),
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  right: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  amount: {
    fontSize: 22,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
  },
} as const;


