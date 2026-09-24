"use client";

import { calcLineTotal } from "@/lib/calcLineTotal";
import { Permission } from "@/lib/permissions";
import { useTenant } from "@/app/providers/TenantProvider";
import LineaCardShell from "@/app/components/arreglos/lineas/shared/LineaCardShell";
import CategoriaArregloSelect from "@/app/components/arreglos/lineas/shared/CategoriaArregloSelect";
import EmpleadoSelect from "@/app/components/arreglos/lineas/shared/EmpleadoSelect";
import TimeDetailPopover from "./TimeDetailPopover";
import ServicioEditableFields from "./ServicioEditableFields";


export type ServicioEditableCardDraft = {
  descripcion: string;
  cantidad: string;            // entero, min 1
  horasFacturadas: string;     // decimal, step 0.25, min 0
  horasTrabajadas: string;     // decimal, step 0.25, min 0
  precioHoraFacturada: string; // entero, min 0
  valorHoraEmpleado: string;
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

type ValidationState = { ok: true } | { ok: false; message?: string };

type Props = {
  mode: "add" | "edit";
  draft: ServicioEditableCardDraft;
  onDraftChange: (patch: Partial<ServicioEditableCardDraft>) => void;
  canInteract: boolean;
  submitting: boolean;
  validation: ValidationState;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ServicioEditableCard({
  mode,
  draft,
  onDraftChange,
  canInteract,
  submitting,
  validation,
  onConfirm,
  onCancel,
}: Props) {
  const { hasPermission } = useTenant();
  const canViewEmployeeCosts = hasPermission(Permission.EmpleadosView);
  const canEditEmployeeCosts = hasPermission(Permission.EmpleadosEdit);
  const canViewPrices = hasPermission(Permission.ArreglosPreciosView);

  const effectiveLaborRate = draft.valorHoraEmpleado.trim() === ""
    ? null
    : Number(draft.valorHoraEmpleado);

  const confirmEnabled = canInteract && validation.ok && !submitting;
  const cancelEnabled = canInteract && !submitting;

  const total = calcLineTotal({
    cantidad: draft.cantidad,
    horas_facturadas: draft.horasFacturadas,
    precio_hora_facturada: draft.precioHoraFacturada,
  });

  return (
    <LineaCardShell
      cardId="work-item-form-card"
      kind="servicios"
      isEditing={true}
      total={total}
      submitting={submitting}
      canConfirm={confirmEnabled}
      canCancel={cancelEnabled}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmAriaLabel={mode === "add" ? "agregar servicio" : "guardar servicio"}
      confirmTitle={
        !validation.ok && validation.message
          ? validation.message
          : mode === "add"
          ? "Agregar"
          : "Confirmar cambios"
      }
      cancelAriaLabel="cancelar servicio"
      cancelTitle="Cancelar edición"
      selectors={
        <>
          {/* Selector de Categoría (Compartido con Repuestos) */}
          <CategoriaArregloSelect
            value={draft.categoriaArregloId}
            onChange={(categoriaArregloId) => onDraftChange({ categoriaArregloId })}
            disabled={!canInteract}
          />

          {/* Selector de Empleado (Compartido con Repuestos, con monto de horas) */}
          <EmpleadoSelect
            value={draft.empleadoId}
            onChange={(empleadoId) => {
              onDraftChange({ empleadoId });
            }}
            disabled={!canInteract}
            showMontoHoras={canViewEmployeeCosts || canEditEmployeeCosts}
            hourlyRate={effectiveLaborRate}
            canViewHourlyRate={canViewEmployeeCosts}
            canEditHourlyRate={canEditEmployeeCosts}
            onChangeHourlyRate={(rate) => onDraftChange({ valorHoraEmpleado: rate == null ? "" : String(rate) })}
          />

          {/* Popover de Detalle de Horas */}
          <TimeDetailPopover
            billedHours={draft.horasFacturadas}
            actualHours={draft.horasTrabajadas}
            unitPrice={draft.precioHoraFacturada}
            quantity={draft.cantidad}
            employeeHourlyRate={effectiveLaborRate}
            canViewEmployeeCost={canViewEmployeeCosts}
            canViewBilledPrice={canViewPrices}
            disabled={!canInteract}
            onChangeBilledHours={(h) => onDraftChange({ horasFacturadas: h })}
            onChangeActualHours={(h) => onDraftChange({ horasTrabajadas: h })}
          />
        </>
      }
    >
      <ServicioEditableFields
        draft={draft}
        onDraftChange={onDraftChange}
        canInteract={canInteract}
        mode={mode}
      />
    </LineaCardShell>
  );
}
