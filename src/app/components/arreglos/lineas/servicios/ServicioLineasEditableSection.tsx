"use client";

import React, { useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeInt, safeNumber } from "@/lib/numbers";
import { COLOR } from "@/theme/theme";
import LineasSectionShell from "@/app/components/arreglos/lineas/shared/LineasSectionShell";
import { styles } from "@/app/components/arreglos/lineas/shared/lineaStyles";
import { useInlineEditor } from "@/app/components/arreglos/lineas/shared/useInlineEditor";
import LineaCardShell from "@/app/components/arreglos/lineas/shared/LineaCardShell";
import CategoriaChip from "@/app/components/arreglos/lineas/shared/CategoriaChip";
import EmpleadoChip from "@/app/components/arreglos/lineas/shared/EmpleadoChip";
import CategoriaArregloSelect from "@/app/components/arreglos/lineas/shared/CategoriaArregloSelect";
import EmpleadoSelect from "@/app/components/arreglos/lineas/shared/EmpleadoSelect";
import TimeDetailPopover from "./TimeDetailPopover";
import ServicioEditableFields from "./ServicioEditableFields";
import type { ServicioEditableCardDraft } from "./ServicioEditableCard";
import { useTenant } from "@/app/providers/TenantProvider";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { Permission } from "@/lib/permissions";
import { calcLineTotal } from "@/lib/calcLineTotal";

export type ServicioLinea = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioHoraFacturada: number;
  horasFacturadas: number;
  horasTrabajadas: number;
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

export type ServicioLineaValue = {
  descripcion: string;
  cantidad: number;
  precioHoraFacturada: number;
  horasFacturadas: number;
  horasTrabajadas: number;
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

type Draft = ServicioEditableCardDraft;

type Props = {
  title?: string;
  emptyText?: string;
  items: ServicioLinea[];
  disabled?: boolean;
  readOnly?: boolean;
  tallerId?: string | null;
  defaultCategoriaArregloId?: string | null;
  defaultEmpleadoId?: string | null;
  onAdd: (input: ServicioLineaValue) => void | Promise<void>;
  onUpdate: (id: string, patch: ServicioLineaValue) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

export default function ServicioLineasEditableSection({
  title = "Mano de Obra",
  emptyText = "Sin servicios realizados.",
  items,
  disabled = false,
  readOnly = false,
  tallerId = null,
  defaultCategoriaArregloId = null,
  defaultEmpleadoId = null,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const { hasPermission, talleres = [], tallerSeleccionadoId } = useTenant();
  const { empleados = [] } = useEmpleados();
  const canEditPrices = hasPermission(Permission.ArreglosPreciosEdit);

  const activeTallerId = tallerId ?? tallerSeleccionadoId;
  const activeTaller = (talleres ?? []).find((t) => t.id === activeTallerId) ?? (talleres ?? [])[0];
  const defaultValorHora =
    activeTaller?.valor_hora != null && activeTaller.valor_hora > 0
      ? String(activeTaller.valor_hora)
      : "";

  const {
    editingId,
    adding,
    isEditing,
    draft,
    setDraft,
    submitting,
    submitError,
    startAdd,
    startEdit,
    cancel,
    save,
    validateCurrent,
  } = useInlineEditor<ServicioLinea, Draft, ServicioLineaValue>({
    items,
    getId: (i) => i.id,
    initialDraft: {
      descripcion: "",
      cantidad: "1",
      horasFacturadas: "1",
      horasTrabajadas: "1",
      precioHoraFacturada: defaultValorHora,
      categoriaArregloId: defaultCategoriaArregloId,
      empleadoId: defaultEmpleadoId,
    },
    draftFromItem: (item) => ({
      descripcion: item.descripcion ?? "",
      cantidad: String(item.cantidad ?? 1),
      horasFacturadas: String(item.horasFacturadas ?? 1),
      horasTrabajadas: String(item.horasTrabajadas ?? 1),
      precioHoraFacturada: String(item.precioHoraFacturada ?? 0),
      categoriaArregloId: item.categoriaArregloId ?? null,
      empleadoId: item.empleadoId ?? null,
    }),
    validate: (d, ctx) => {
      const descripcion = d.descripcion.trim();
      const cantidad = safeInt(d.cantidad);
      const horasFacturadas = safeNumber(d.horasFacturadas);
      const horasTrabajadas = safeNumber(d.horasTrabajadas);

      const precioHoraFacturada = canEditPrices
        ? safeNumber(d.precioHoraFacturada)
        : ctx.mode === "edit" ? safeNumber(ctx.item?.precioHoraFacturada) : 0;

      if (!descripcion) return { ok: false as const, message: "Falta descripción" };
      if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false as const, message: "Cantidad inválida" };
      if (!Number.isFinite(horasFacturadas) || horasFacturadas < 0) return { ok: false as const, message: "Horas facturadas inválidas" };
      if (!Number.isFinite(horasTrabajadas) || horasTrabajadas < 0) return { ok: false as const, message: "Horas trabajadas inválidas" };
      if (!Number.isFinite(precioHoraFacturada) || precioHoraFacturada < 0) return { ok: false as const, message: "Precio hora inválido" };
      return {
        ok: true as const,
        value: {
          descripcion,
          cantidad,
          horasFacturadas,
          horasTrabajadas,
          precioHoraFacturada,
          categoriaArregloId: d.categoriaArregloId,
          empleadoId: d.empleadoId,
        },
      };
    },
    onAdd,
    onUpdate,
    cancelWhen: readOnly,
  });

  const subtotalValue = useMemo(
    () =>
      items.reduce(
        (acc, i) =>
          acc +
          calcLineTotal({
            cantidad: i.cantidad,
            horas_facturadas: i.horasFacturadas,
            precio_hora_facturada: i.precioHoraFacturada,
          }),
        0
      ),
    [items]
  );
  const subtotal = useMemo(
    () => formatArs(subtotalValue, { maxDecimals: 0, minDecimals: 0 }),
    [subtotalValue]
  );

  const canInteract = !disabled && !readOnly && !submitting;

  const activeRate = activeTaller?.valor_hora ?? 0;
  const [customLaborRate, setCustomLaborRate] = useState<number | null>(null);

  const renderLineaCard = (item: ServicioLinea | null, mode: "add" | "edit") => {
    const isAdding = mode === "add";
    const validation = validateCurrent();
    const confirmEnabled = canInteract && validation.ok && !submitting;
    const cancelEnabled = canInteract && !submitting;
    const currentDraftTotal = calcLineTotal({
      cantidad: draft.cantidad,
      horas_facturadas: draft.horasFacturadas,
      precio_hora_facturada: draft.precioHoraFacturada,
    });

    const draftEmp = empleados.find((e) => e.id === draft.empleadoId);
    const draftEmpBaseRate =
      draftEmp?.salario != null && draftEmp.salario > 0 ? draftEmp.salario : activeRate;
    const effectiveLaborRate = customLaborRate ?? draftEmpBaseRate;

    const selectors = (
      <>
        <CategoriaArregloSelect
          value={draft.categoriaArregloId}
          onChange={(categoriaArregloId) => setDraft((p) => ({ ...p, categoriaArregloId }))}
          disabled={!canInteract}
        />
        <EmpleadoSelect
          value={draft.empleadoId}
          onChange={(empleadoId) => {
            setDraft((p) => ({ ...p, empleadoId }));
            setCustomLaborRate(null);
          }}
          disabled={!canInteract}
          showMontoHoras={true}
          hourlyRate={effectiveLaborRate}
          defaultHourlyRate={activeRate}
          onChangeHourlyRate={(rate) => setCustomLaborRate(rate)}
        />
        <TimeDetailPopover
          billedHours={draft.horasFacturadas}
          actualHours={draft.horasTrabajadas}
          unitPrice={draft.precioHoraFacturada}
          quantity={draft.cantidad}
          employeeHourlyRate={effectiveLaborRate}
          disabled={!canInteract}
          onChangeBilledHours={(h) => setDraft((p) => ({ ...p, horasFacturadas: h }))}
          onChangeActualHours={(h) => setDraft((p) => ({ ...p, horasTrabajadas: h }))}
        />
      </>
    );

    const editableFields = (
      <ServicioEditableFields
        draft={draft}
        onDraftChange={(patch) => setDraft((p) => ({ ...p, ...patch }))}
        canInteract={canInteract}
        mode={mode}
      />
    );

    if (isAdding) {
      return (
        <LineaCardShell
          cardId="work-item-form-card"
          kind="servicios"
          isEditing={true}
          total={currentDraftTotal}
          submitting={submitting}
          canConfirm={confirmEnabled}
          canCancel={cancelEnabled}
          onConfirm={save}
          onCancel={cancel}
          confirmAriaLabel="agregar servicio"
          confirmTitle={!validation.ok && validation.message ? validation.message : "Agregar"}
          cancelAriaLabel="cancelar servicio"
          cancelTitle="Cancelar edición"
          selectors={selectors}
        >
          {editableFields}
        </LineaCardShell>
      );
    }

    if (!item) return null;

    const emp = empleados.find((e) => e.id === (editingId === item.id ? draft.empleadoId : item.empleadoId));
    const empRate = emp?.salario != null && emp.salario > 0 ? emp.salario : activeRate;

    return (
      <LineaCardShell
        key={item.id}
        cardId={editingId === item.id ? "work-item-form-card" : undefined}
        kind="servicios"
        isEditing={editingId === item.id}
        // Vista no editable
        title={item.descripcion || "Sin nombre"}
        subtitle={
          <>
            <CategoriaChip categoriaArregloId={item.categoriaArregloId} />
            <EmpleadoChip empleadoId={item.empleadoId} showMontoHoras={true} rate={empRate} />
          </>
        }
        cantidad={Number(item.cantidad) || 0}
        unitario={Number(item.precioHoraFacturada) || 0}
        horasFacturadas={item.horasFacturadas}
        horasTrabajadas={item.horasTrabajadas}
        valorHoraEmpleado={empRate}
        onEdit={() => startEdit(item)}
        onDelete={() => onDelete(item.id)}
        canInteract={canInteract && !isEditing}
        readOnly={readOnly}
        // Vista editable
        total={currentDraftTotal}
        submitting={submitting}
        canConfirm={confirmEnabled}
        canCancel={cancelEnabled}
        onConfirm={save}
        onCancel={cancel}
        confirmAriaLabel="guardar servicio"
        confirmTitle={!validation.ok && validation.message ? validation.message : "Confirmar cambios"}
        cancelAriaLabel="cancelar servicio"
        cancelTitle="Cancelar edición"
        selectors={selectors}
      >
        {editableFields}
      </LineaCardShell>
    );
  };

  return (
    <LineasSectionShell
      title={title}
      titleIcon={<Wrench size={18} />}
      subtotal={subtotal}
      collapseDisabled={isEditing}
    >
      <div style={styles.list}>
        {submitError ? (
          <div style={{ color: COLOR.ICON.DANGER, fontWeight: 700, fontSize: 13 }}>
            {submitError}
          </div>
        ) : null}

        {items.length === 0 && !adding ? (
          <div style={styles.emptyState}>{emptyText}</div>
        ) : null}

        {items.map((item) => renderLineaCard(item, "edit"))}

        {adding ? (
          renderLineaCard(null, "add")
        ) : readOnly ? null : (
          <button
            type="button"
            style={styles.addRowBtn}
            onClick={startAdd}
            disabled={!canInteract || isEditing}
          >
            <Plus size={18} />
            Agregar Mano de Obra
          </button>
        )}
      </div>
    </LineasSectionShell>
  );
}
