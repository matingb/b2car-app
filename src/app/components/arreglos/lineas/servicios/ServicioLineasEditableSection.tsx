"use client";

import React, { useMemo } from "react";
import { Plus, Wrench } from "lucide-react";
import { formatArs } from "@/lib/format";
import { safeNumber } from "@/lib/numbers";
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
import { Permission } from "@/lib/permissions";
import { calcLineTotal } from "@/lib/calcLineTotal";
import { hasAtMostDecimalPlaces } from "@/lib/numbers";

export type ServicioLinea = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioHoraFacturada: number;
  horasFacturadas: number | null;
  horasTrabajadas: number | null;
  valorHoraEmpleado: number | null;
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

export type ServicioLineaValue = {
  descripcion: string;
  cantidad: number;
  precioHoraFacturada: number;
  horasFacturadas: number | null;
  horasTrabajadas: number | null;
  valorHoraEmpleado?: number | null;
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
  const canEditPrices = hasPermission(Permission.ArreglosPreciosEdit);
  const canViewPrices = hasPermission(Permission.ArreglosPreciosView);

  const activeTallerId = tallerId ?? tallerSeleccionadoId;
  const activeTaller = (talleres ?? []).find((t) => t.id === activeTallerId);
  const defaultValorHora =
    activeTaller?.valor_hora != null
      ? String(activeTaller.valor_hora)
      : "";
  const canViewEmployeeCosts = hasPermission(Permission.EmpleadosView);
  const canEditEmployeeCosts = hasPermission(Permission.EmpleadosEdit);

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
      valorHoraEmpleado: "",
      categoriaArregloId: defaultCategoriaArregloId,
      empleadoId: defaultEmpleadoId,
    },
    draftFromItem: (item) => ({
      descripcion: item.descripcion ?? "",
      cantidad: String(item.cantidad ?? 1),
      horasFacturadas: item.horasFacturadas == null ? "" : String(item.horasFacturadas),
      horasTrabajadas: item.horasTrabajadas == null ? "" : String(item.horasTrabajadas),
      precioHoraFacturada: String(item.precioHoraFacturada ?? 0),
      valorHoraEmpleado: item.valorHoraEmpleado == null ? "" : String(item.valorHoraEmpleado),
      categoriaArregloId: item.categoriaArregloId ?? null,
      empleadoId: item.empleadoId ?? null,
    }),
    validate: (d, ctx) => {
      const descripcion = d.descripcion.trim();
      const cantidad = d.cantidad.trim() === "" ? Number.NaN : Number(d.cantidad);
      const horasFacturadas = d.horasFacturadas === ""
        ? ctx.mode === "edit" && ctx.item?.horasFacturadas == null ? null : Number.NaN
        : safeNumber(d.horasFacturadas);
      const horasTrabajadas = d.horasTrabajadas === ""
        ? ctx.mode === "edit" && ctx.item?.horasTrabajadas == null ? null : Number.NaN
        : safeNumber(d.horasTrabajadas);

      const precioHoraFacturada = canEditPrices
        ? safeNumber(d.precioHoraFacturada)
        : ctx.mode === "edit" ? safeNumber(ctx.item?.precioHoraFacturada) : safeNumber(d.precioHoraFacturada);
      const valorHoraEmpleado = d.valorHoraEmpleado.trim() === ""
        ? null
        : safeNumber(d.valorHoraEmpleado);
      const oldValorHoraEmpleado = ctx.item?.valorHoraEmpleado ?? null;
      const shouldUpdateEmployeeRate = ctx.mode === "add" || valorHoraEmpleado !== oldValorHoraEmpleado;

      if (!descripcion) return { ok: false as const, message: "Falta descripción" };
      if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 2_147_483_647) return { ok: false as const, message: "Cantidad inválida" };
      if (horasFacturadas !== null && (!Number.isFinite(horasFacturadas) || horasFacturadas < 0 || horasFacturadas > 9999.99 || !hasAtMostDecimalPlaces(horasFacturadas))) return { ok: false as const, message: "Horas facturadas inválidas" };
      if (horasTrabajadas !== null && (!Number.isFinite(horasTrabajadas) || horasTrabajadas < 0 || horasTrabajadas > 9999.99 || !hasAtMostDecimalPlaces(horasTrabajadas))) return { ok: false as const, message: "Horas trabajadas inválidas" };
      if (!Number.isFinite(precioHoraFacturada) || precioHoraFacturada < 0 || precioHoraFacturada > 9_999_999_999.99 || !hasAtMostDecimalPlaces(precioHoraFacturada)) return { ok: false as const, message: "Precio hora inválido" };
      if (valorHoraEmpleado !== null && (!Number.isFinite(valorHoraEmpleado) || valorHoraEmpleado < 0 || valorHoraEmpleado > 9_999_999_999.99 || !hasAtMostDecimalPlaces(valorHoraEmpleado))) return { ok: false as const, message: "Valor hora del empleado inválido" };
      return {
        ok: true as const,
        value: {
          descripcion,
          cantidad,
          horasFacturadas,
          horasTrabajadas,
          precioHoraFacturada,
          ...(shouldUpdateEmployeeRate ? { valorHoraEmpleado } : {}),
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
    () => formatArs(subtotalValue, { maxDecimals: 2, minDecimals: 0 }),
    [subtotalValue]
  );

  const canInteract = !disabled && !readOnly && !submitting;

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

    const effectiveLaborRate = draft.valorHoraEmpleado.trim() === ""
      ? null
      : safeNumber(draft.valorHoraEmpleado);

    const selectors = (
      <>
        <CategoriaArregloSelect
          value={draft.categoriaArregloId}
          onChange={(categoriaArregloId) => setDraft((p) => ({ ...p, categoriaArregloId }))}
          disabled={!canInteract}
        />
        <EmpleadoSelect
          value={draft.empleadoId}
          tallerId={activeTallerId}
          onChange={(empleadoId) => {
            setDraft((p) => ({ ...p, empleadoId }));
          }}
          disabled={!canInteract}
          showMontoHoras={canViewEmployeeCosts || canEditEmployeeCosts}
          hourlyRate={effectiveLaborRate}
          canViewHourlyRate={canViewEmployeeCosts}
          canEditHourlyRate={canEditEmployeeCosts}
          onChangeHourlyRate={(rate) => setDraft((p) => ({ ...p, valorHoraEmpleado: rate == null ? "" : String(rate) }))}
        />
        <TimeDetailPopover
          billedHours={draft.horasFacturadas}
          actualHours={draft.horasTrabajadas}
          unitPrice={draft.precioHoraFacturada}
          quantity={draft.cantidad}
          employeeHourlyRate={effectiveLaborRate}
          canViewEmployeeCost={canViewEmployeeCosts}
          canViewBilledPrice={canViewPrices}
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
            <EmpleadoChip empleadoId={item.empleadoId} showMontoHoras={canViewEmployeeCosts} rate={item.valorHoraEmpleado} />
          </>
        }
        cantidad={Number(item.cantidad) || 0}
        unitario={Number(item.precioHoraFacturada) || 0}
        horasFacturadas={item.horasFacturadas}
        horasTrabajadas={item.horasTrabajadas}
        valorHoraEmpleado={item.valorHoraEmpleado}
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
