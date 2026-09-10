"use client";

import React from "react";
import { Clock } from "lucide-react";
import Calendar from "@/app/components/ui/Calendar";
import Dropdown from "@/app/components/ui/Dropdown";
import Toggle from "@/app/components/ui/Toggle";
import { COLOR } from "@/theme/theme";
import { formatFechaPill, formatFechaMobile, HORA_INICIO_LABORAL, DURACION_TODO_EL_DIA } from "@/lib/turnosHorarios";
import { turnoFormStyles as styles } from "@/app/components/turnos/TurnoFormFieldsStyles";
import type { UseTurnoHorariosResult } from "@/app/components/turnos/hooks/useTurnoHorarios";

type Props = {
  fecha: string;
  horarios: UseTurnoHorariosResult;
  onChange: (patch: { fecha?: string; hora?: string; duracion?: number }) => void;
};

export default function TurnoDateTimePicker({ fecha, horarios, onChange }: Props) {
  const {
    horaInicioValida,
    horaFinCalculada,
    isHoraFinValida,
    horasFinOptions,
    horasInicioDropdownOptions,
    horasFinDropdownOptions,
    horasInicioDropdownOptionsMobile,
    horasFinDropdownOptionsMobile,
    isAllDay,
    calcularDuracionDesdeHoraFin,
  } = horarios;

  const handleAllDayChange = (checked: boolean) => {
    if (checked) {
      onChange({ hora: HORA_INICIO_LABORAL, duracion: DURACION_TODO_EL_DIA });
    } else {
      onChange({ hora: "09:00", duracion: 60 });
    }
  };

  const horaFinValue = isHoraFinValida ? horaFinCalculada : horasFinOptions[0];

  return (
    <div style={styles.calendarPickerContainer}>
      {/* Desktop */}
      <div css={styles.desktopPicker}>
        <div style={styles.calendarPickerRow}>
          <Clock size={20} color={COLOR.TEXT.SECONDARY} style={{ flexShrink: 0 }} />

          <Calendar
            value={fecha}
            onChange={(f) => onChange({ fecha: f })}
            dataTestId="turno-fecha-picker-desktop"
          >
            <div style={styles.datePillWrapper} title="Hacé clic para cambiar la fecha">
              <span style={styles.datePillText}>
                {formatFechaPill(fecha) || fecha}
              </span>
            </div>
          </Calendar>

          {!isAllDay && (
            <>
              <Dropdown
                options={horasInicioDropdownOptions}
                value={horaInicioValida}
                onChange={(v) => onChange({ hora: v })}
                style={styles.dropdownHoraInicio}
                dataTestId="turno-hora-desde"
              />

              <span style={styles.pillSeparator}>–</span>

              <Dropdown
                options={horasFinDropdownOptions}
                value={horaFinValue}
                onChange={(v) => onChange({ duracion: calcularDuracionDesdeHoraFin(v) })}
                style={styles.dropdownHoraFin}
                dropdownWidth={150}
                dataTestId="turno-hora-hasta"
              />
            </>
          )}
        </div>

        <div style={styles.allDayRow}>
          <input
            type="checkbox"
            id="turno-all-day"
            checked={isAllDay}
            onChange={(e) => handleAllDayChange(e.target.checked)}
            style={styles.checkbox}
          />
          <label htmlFor="turno-all-day" style={styles.allDayLabel}>
            Todo el día
          </label>
        </div>
      </div>

      {/* Mobile */}
      <div css={styles.mobilePicker}>
        <div style={styles.mobileAllDayRow}>
          <div style={styles.mobileClockAndLabel}>
            <Clock size={20} color={COLOR.TEXT.SECONDARY} style={{ flexShrink: 0 }} />
            <span style={styles.mobileSectionTitle}>Todo el día</span>
          </div>
          <Toggle
            checked={isAllDay}
            onChange={handleAllDayChange}
            label="Todo el día"
          />
        </div>

        <div style={styles.mobileDateTimeRow}>
          <Calendar
            value={fecha}
            onChange={(f) => onChange({ fecha: f })}
            dataTestId="turno-fecha-picker-mobile"
          >
            <div style={styles.mobileDateWrapper} title="Hacé clic para cambiar la fecha">
              <span style={styles.mobileDateText}>
                {formatFechaMobile(fecha) || fecha}
              </span>
            </div>
          </Calendar>
        </div>

        {!isAllDay && (
          <div style={styles.mobileTimeRangeRow}>
            <div style={styles.mobileTimeItem}>
              <span style={styles.mobileTimeLabel}>Desde:</span>
              <Dropdown
                options={horasInicioDropdownOptionsMobile}
                value={horaInicioValida}
                onChange={(v) => onChange({ hora: v })}
                style={styles.dropdownHoraMobile}
                dataTestId="turno-hora-desde-mobile"
              />
            </div>

            <div style={styles.mobileTimeItem}>
              <span style={styles.mobileTimeLabel}>Hasta:</span>
              <Dropdown
                options={horasFinDropdownOptionsMobile}
                value={horaFinValue}
                onChange={(v) => onChange({ duracion: calcularDuracionDesdeHoraFin(v) })}
                style={styles.dropdownHoraMobile}
                dataTestId="turno-hora-hasta-mobile"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
