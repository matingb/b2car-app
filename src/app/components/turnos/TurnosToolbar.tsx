"use client";

import React from "react";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import FilterChip from "@/app/components/ui/FilterChip";
import { css } from "@emotion/react";
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react";
import { VistaTurnos } from "@/app/hooks/useTurnosCalendar";

type Props = {
  vista: VistaTurnos;
  onChangeVista: (v: VistaTurnos) => void;
  periodoLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewTurno: () => void;
};

const VISTAS_TURNOS: ReadonlyArray<{ key: VistaTurnos; label: string }> = [
  { key: VistaTurnos.Mensual, label: "Mensual" },
  { key: VistaTurnos.Semanal, label: "Semanal" },
  { key: VistaTurnos.Diaria, label: "Diaria" },
];

export default function TurnosToolbar({
  vista,
  onChangeVista,
  periodoLabel,
  onPrev,
  onNext,
  onToday,
  onNewTurno,
}: Props) {
  return (
    <div css={styles.toolbar}>
      <div css={styles.toolbarLeft}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconButton
            icon={<ChevronLeft />}
            onClick={onPrev}
            title="Anterior"
            ariaLabel="Anterior"
          />
          <div><h2>{periodoLabel}</h2></div>
          <IconButton
            icon={<ChevronRight />}
            onClick={onNext}
            title="Siguiente"
            ariaLabel="Siguiente"
          />
        </div>

        <Button
          text="Hoy"
          outline
          hideText={false}
          onClick={onToday}
          style={{ minWidth: 0, height: 40 }}
        />
      </div>

      <div css={styles.toolbarRight}>
        <div css={styles.tabs}>
          {VISTAS_TURNOS.map(({ key, label }) => (
            <FilterChip
              key={key}
              text={label}
              selected={vista === key}
              onClick={() => onChangeVista(key)}
            />
          ))}
        </div>

        <Button
          icon={<PlusIcon size={20} />}
          text="Nuevo turno"
          onClick={onNewTurno}
          style={{ height: 40 }}
        />
      </div>
    </div>
  );
}

const styles = {
  toolbar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  }),
  toolbarLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  }),
  toolbarRight: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    flex: 1,
  }),
  tabs: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
} as const;

