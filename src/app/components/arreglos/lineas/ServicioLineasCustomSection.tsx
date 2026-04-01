"use client";

import React, { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { AlertTriangle, Check, CheckCircle2, Circle, LibraryBig, Pencil } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import type { ServicioLinea } from "./ServicioLineasEditableSection";
import type { ArregloFormularioLineaValue } from "@/app/api/arreglos/arregloRequests";
import LineasSectionShell from "./LineasSectionShell";
import Card from "../../ui/Card";
import Autocomplete from "../../ui/Autocomplete";
import { styles as lineaStyles } from "./lineaStyles";

type CustomFieldDef = {
  key: string;
  label: string;
  component:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "select"
    | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
};

export type CustomServicioLineDef = {
  id: string;
  title?: string;
  descripcion: string;
  cantidad?: number;
  valor?: number;
  fields: CustomFieldDef[];
};

type Props = {
  formTitle?: string;
  defaultCosto?: number;
  lineDefs: CustomServicioLineDef[];
  initialDetalle?: {
    costo?: number;
    metadata?: ArregloFormularioLineaValue[];
  } | null;
  editableOnLoad?: boolean;
  showEditButton?: boolean;
  disabled?: boolean;
  onServiciosChange?: (items: ServicioLinea[]) => void;
  onDetalleChange?: (payload: {
    costo: number;
    metadata: ArregloFormularioLineaValue[];
  }) => void;
  onConfirmEdit?: (payload: {
    costo: number;
    metadata: ArregloFormularioLineaValue[];
    items: ServicioLinea[];
  }) => Promise<void> | void;
};

type RawRecord = Record<string, unknown>;

type LineRuntimeState = {
  values: Record<string, string>;
};

function asRecord(input: unknown): RawRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as RawRecord;
}

function parseOptions(input: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(input)) return [];

  const out: Array<{ value: string; label: string }> = [];
  for (const option of input) {
    if (typeof option === "string") {
      out.push({ value: option, label: option });
      continue;
    }

    const record = asRecord(option);
    if (!record) continue;

    const value = String(record.value ?? "").trim();
    if (!value) continue;

    const label = String(record.label ?? value).trim() || value;
    out.push({ value, label });
  }

  return out;
}

function parseComponentType(raw: unknown): CustomFieldDef["component"] {
  const normalized = String(raw ?? "text").trim().toLowerCase();
  if (normalized === "input") return "text";
  if (normalized === "textarea") return "textarea";
  if (normalized === "number") return "number";
  if (normalized === "money" || normalized === "currency") return "money";
  if (normalized === "checkbox") return "checkbox";
  if (normalized === "selector") return "select";
  if (normalized === "select" || normalized === "dropdown") return "select";
  return "text";
}

function parseFields(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return [];

  const fields: CustomFieldDef[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const record = asRecord(raw[index]);
    if (!record) continue;

    const key = String(
      record.key ?? record.name ?? record.title ?? record.label ?? `field_${index + 1}`
    ).trim();
    if (!key) continue;

    const label = String(record.label ?? record.title ?? key).trim() || key;
    const component = parseComponentType(record.component ?? record.tipo ?? record.type);
    const required = Boolean(record.required);
    const placeholder =
      record.placeholder == null ? undefined : String(record.placeholder);
    const options = parseOptions(record.options ?? record.values);

    const defaultCandidate = record.defaultValue ?? record.default;
    const defaultValue =
      typeof defaultCandidate === "string" ||
      typeof defaultCandidate === "number" ||
      typeof defaultCandidate === "boolean"
        ? defaultCandidate
        : undefined;

    fields.push({
      key,
      label,
      component,
      required,
      placeholder,
      options,
      defaultValue,
    });
  }

  return fields;
}

function parseAsNestedLines(metadata: unknown): CustomServicioLineDef[] {
  if (!Array.isArray(metadata)) return [];

  const out: CustomServicioLineDef[] = [];
  for (let i = 0; i < metadata.length; i += 1) {
    const lineRaw = metadata[i];
    if (!Array.isArray(lineRaw)) continue;

    const fields = parseFields(lineRaw);
    const firstWithTitle = lineRaw
      .map((entry) => asRecord(entry))
      .find((entry) => {
        const title = String(entry?.title ?? entry?.titulo ?? "").trim();
        return title.length > 0;
      });

    const title = String(firstWithTitle?.title ?? firstWithTitle?.titulo ?? "").trim();
    const fallback = ``;

    out.push({
      id: `custom_line_${i + 1}`,
      title: title || fallback,
      descripcion: title || fallback,
      cantidad: 1,
      valor: 0,
      fields,
    });
  }

  return out;
}

function parseAsObjectLines(metadata: unknown): CustomServicioLineDef[] {
  if (!Array.isArray(metadata)) return [];

  const out: CustomServicioLineDef[] = [];
  for (let i = 0; i < metadata.length; i += 1) {
    const row = asRecord(metadata[i]);
    if (!row) continue;

    const title = String(
      row.title ?? row.titulo ?? row.descripcion ?? `Servicio custom ${i + 1}`
    ).trim();
    const inputs = Array.isArray(row.inputs) ? row.inputs : [];
    const fields = parseFields(inputs);

    const cantidadRaw = Number(row.cantidad ?? 1);
    const valorRaw = Number(row.valor ?? 0);

    out.push({
      id: String(row.id ?? `custom_line_${i + 1}`),
      title,
      descripcion: title,
      cantidad: Number.isFinite(cantidadRaw) && cantidadRaw > 0 ? cantidadRaw : 1,
      valor: Number.isFinite(valorRaw) && valorRaw >= 0 ? valorRaw : 0,
      fields,
    });
  }

  return out;
}

export function parseCustomServicioLineDefs(metadata: unknown): CustomServicioLineDef[] {
  const objectLines = parseAsObjectLines(metadata);
  if (objectLines.length > 0) return objectLines;

  const nested = parseAsNestedLines(metadata);
  if (nested.length > 0) return nested;

  const sourceArray = Array.isArray(metadata)
    ? metadata
    : Array.isArray(asRecord(metadata)?.lineas)
      ? (asRecord(metadata)?.lineas as unknown[])
      : [];

  const out: CustomServicioLineDef[] = [];

  for (let i = 0; i < sourceArray.length; i += 1) {
    const row = asRecord(sourceArray[i]);
    if (!row) continue;

    const id = String(row.id ?? `custom_line_${i + 1}`).trim();
    const descripcion = String(
      row.descripcion ?? row.nombre ?? `Servicio custom ${i + 1}`
    ).trim();
    const title = String(
      row.title ?? row.titulo ?? descripcion ?? `Servicio custom ${i + 1}`
    ).trim();

    const fields = parseFields(row.fields ?? row.componentes);

    const cantidadRaw = Number(row.cantidad ?? 1);
    const valorRaw = Number(row.valor ?? 0);

    out.push({
      id: id || `custom_line_${i + 1}`,
      title: title || undefined,
      descripcion: descripcion || `Servicio custom ${i + 1}`,
      cantidad: Number.isFinite(cantidadRaw) && cantidadRaw > 0 ? cantidadRaw : 1,
      valor: Number.isFinite(valorRaw) && valorRaw >= 0 ? valorRaw : 0,
      fields,
    });
  }

  return out;
}

function makeInitialState(
  lineDefs: CustomServicioLineDef[],
  initialMetadata?: ArregloFormularioLineaValue[]
): Record<string, LineRuntimeState> {
  const next: Record<string, LineRuntimeState> = {};

  for (let index = 0; index < lineDefs.length; index += 1) {
    const line = lineDefs[index];
    const metadataLine = Array.isArray(initialMetadata)
      ? initialMetadata[index]
      : undefined;

    const values: Record<string, string> = {
      __titulo:
        String(metadataLine?.title ?? line.title ?? line.descripcion).trim() ||
        line.title ||
        line.descripcion,
    };

    for (const field of line.fields) {
      const fromMetadata = metadataLine?.inputs?.find((input) => {
        const inputTitle = String(input?.title ?? "").trim().toLowerCase();
        return (
          inputTitle === String(field.label).trim().toLowerCase() ||
          inputTitle === String(field.key).trim().toLowerCase()
        );
      });

      if (fromMetadata) {
        const metadataValue = fromMetadata.value;
        if (typeof metadataValue === "boolean") {
          values[field.key] = metadataValue ? "true" : "false";
        } else if (metadataValue == null) {
          values[field.key] = "";
        } else {
          values[field.key] = String(metadataValue);
        }
        continue;
      }

      values[field.key] = field.defaultValue == null ? "" : String(field.defaultValue);
    }

    next[line.id] = { values };
  }

  return next;
}

function parseNumber(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildServicioLinea(
  line: CustomServicioLineDef,
  state: LineRuntimeState,
  lineIndex: number,
  costoTotal: number
): ServicioLinea {
  const tituloBase = String(
    state.values.__titulo ?? line.title ?? line.descripcion
  ).trim() || line.title || line.descripcion;

  const parts: string[] = [];

  for (const field of line.fields) {
    if (field.key === "cantidad" || field.key === "valor") continue;
    const rawValue = String(state.values[field.key] ?? "").trim();
    if (!rawValue) continue;
    const value =
      field.component === "checkbox"
        ? rawValue === "true"
          ? "Si"
          : rawValue === "false"
            ? "No"
            : ""
        : rawValue;
    if (!value) continue;
    parts.push(`${field.label}: ${value}`);
  }

  const cantidad = Math.max(1, Number(line.cantidad ?? 1) || 1);
  const valor = Math.max(0, lineIndex === 0 ? costoTotal : 0);

  return {
    id: line.id,
    descripcion: parts.length > 0 ? `${tituloBase} - ${parts.join(" | ")}` : tituloBase,
    cantidad,
    valor,
  };
}

function isFieldAnswered(field: CustomFieldDef, value: unknown): boolean {
  const normalized = String(value ?? "").trim();
  if (field.component === "checkbox") {
    return normalized === "true" || normalized === "false";
  }
  return normalized.length > 0;
}

type LineVisualStatus = "complete" | "warning" | "pending";

function getLineVisualStatus(
  line: CustomServicioLineDef,
  state: LineRuntimeState
): LineVisualStatus {
  const requiredFields = line.fields.filter((field) => field.required);
  const answeredCount = line.fields.filter((field) =>
    isFieldAnswered(field, state.values[field.key])
  ).length;
  const completedRequired = requiredFields.filter((field) =>
    isFieldAnswered(field, state.values[field.key])
  ).length;
  const missingRequired = requiredFields.length - completedRequired;

  if (requiredFields.length > 0) {
    if (missingRequired === 0) {
      return "complete";
    }

    if (answeredCount > 0) {
      return "warning";
    }

    return "pending";
  }

  if (answeredCount > 0) {
    return "complete";
  }

  return "pending";
}

function getLineTitle(line: CustomServicioLineDef, state: LineRuntimeState): string {
  return (
    String(state.values.__titulo ?? line.title ?? line.descripcion).trim() ||
    line.title ||
    line.descripcion
  );
}

export default function ServicioLineasCustomSection({
  formTitle,
  defaultCosto,
  lineDefs,
  initialDetalle,
  editableOnLoad = true,
  showEditButton = false,
  disabled = false,
  onServiciosChange,
  onDetalleChange,
  onConfirmEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState<boolean>(editableOnLoad);
  const initialStateByLine = useMemo(
    () => makeInitialState(lineDefs, initialDetalle?.metadata),
    [lineDefs, initialDetalle?.metadata]
  );

  const [formCostoInput, setFormCostoInput] = useState<string>(() =>
    String(
      Number.isFinite(Number(initialDetalle?.costo))
        ? Number(initialDetalle?.costo)
        : Number.isFinite(Number(defaultCosto))
          ? Number(defaultCosto)
          : 0
    )
  );

  const [stateByLine, setStateByLine] = useState<Record<string, LineRuntimeState>>(
    () => initialStateByLine
  );
  const [dirtyFieldsByLine, setDirtyFieldsByLine] = useState<
    Record<string, Record<string, boolean>>
  >({});

  useEffect(() => {
    setIsEditing(editableOnLoad);
    setStateByLine(initialStateByLine);
    setDirtyFieldsByLine({});
    setFormCostoInput(
      String(
        Number.isFinite(Number(initialDetalle?.costo))
          ? Number(initialDetalle?.costo)
          : Number.isFinite(Number(defaultCosto))
            ? Number(defaultCosto)
            : 0
      )
    );
  }, [initialStateByLine, defaultCosto, initialDetalle, editableOnLoad]);

  const costoTotal = useMemo(
    () =>
      Math.max(
        0,
        parseNumber(
          formCostoInput,
          Number(initialDetalle?.costo ?? defaultCosto) || 0
        )
      ),
    [formCostoInput, defaultCosto, initialDetalle?.costo]
  );

  const items = useMemo(() => {
    return lineDefs.map((line, index) => {
      const state = stateByLine[line.id] ?? { values: {} };
      return buildServicioLinea(line, state, index, costoTotal);
    });
  }, [lineDefs, stateByLine, costoTotal]);

  useEffect(() => {
    onServiciosChange?.(items);
  }, [items, onServiciosChange]);

  const detalleMetadata = useMemo<ArregloFormularioLineaValue[]>(() => {
    return lineDefs.map((line) => {
      const lineState = stateByLine[line.id] ?? { values: {} };
      const title = String(
        lineState.values.__titulo ?? line.title ?? line.descripcion
      ).trim() || line.title || line.descripcion;

      return {
        title,
        inputs: line.fields.map((field) => {
          const raw = lineState.values[field.key];
          const value: string | boolean | null =
            field.component === "checkbox"
              ? raw === "true"
                ? true
                : raw === "false"
                  ? false
                  : null
              : raw == null || raw === ""
                ? null
                : String(raw);

          return {
            title: field.label,
            value,
          };
        }),
      };
    });
  }, [lineDefs, stateByLine]);

  useEffect(() => {
    onDetalleChange?.({
      costo: costoTotal,
      metadata: detalleMetadata,
    });
  }, [onDetalleChange, costoTotal, detalleMetadata]);

  const subtotal = formCostoInput;
  const lineCards = useMemo(
    () =>
      lineDefs.map((line) => {
        const lineState = stateByLine[line.id] ?? { values: {} };
        return {
          line,
          lineState,
          title: getLineTitle(line, lineState),
          status: getLineVisualStatus(line, lineState),
        };
      }),
    [lineDefs, stateByLine]
  );
  const completedItemsCount = useMemo(
    () => lineCards.filter(({ status }) => status === "complete").length,
    [lineCards]
  );

  const updateField = (lineId: string, key: string, value: string) => {
    setStateByLine((prev) => ({
      ...prev,
      [lineId]: {
        values: {
          ...(prev[lineId]?.values ?? {}),
          [key]: value,
        },
      },
    }));
    setDirtyFieldsByLine((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] ?? {}),
        [key]: true,
      },
    }));
  };

  const handleHeaderEditClick = async () => {
    if (disabled) return;

    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    try {
      await onConfirmEdit?.({
        costo: costoTotal,
        metadata: detalleMetadata,
        items,
      });
      setIsEditing(false);
    } catch {
      // Keep editing mode when save fails.
    }
  };

  return (
    <LineasSectionShell
      title={formTitle?.trim() || "Formulario"}
      titleIcon={<LibraryBig size={18} />}
      subtotalBeforeLabel={
        showEditButton ? (
          <button
            type="button"
            title={isEditing ? "Confirmar" : "Editar"}
            style={customStyles.headerEditIconButton}
            aria-label={isEditing ? "Confirmar cambios" : "Editar formulario"}
            onClick={handleHeaderEditClick}
            disabled={disabled}
          >
            {isEditing ? (
              <Check size={18} color={COLOR.ACCENT.PRIMARY} />
            ) : (
              <Pencil size={18} color={COLOR.ICON.MUTED} />
            )}
          </button>
        ) : null
      }
      subtotal={
        isEditing ? (
          <input
            value={subtotal}
            onChange={(e) => setFormCostoInput(e.target.value.replace(/\D/g, ""))}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Costo total formulario custom"
            style={customStyles.headerCostoInput}
          />
        ) : (
          <span style={customStyles.headerCostoValue}>
            {formatArs(costoTotal, { maxDecimals: 0, minDecimals: 0 })}
          </span>
        )
      }
      subtotalLabel="Costo $"
    >
      <Card css={customStyles.listCard}>
        {lineDefs.length > 0 ? (
          <div css={customStyles.summaryRow}>
            <span css={customStyles.summaryValue}>
              {completedItemsCount} de {lineCards.length} items cargados
            </span>
          </div>
        ) : null}
        <div css={customStyles.rowsList}>
          {lineDefs.length === 0 ? (
            <div style={lineaStyles.emptyState}>Sin lineas custom configuradas.</div>
          ) : null}

          {lineCards.map(({ line, lineState, title, status }, lineIndex) => {
            const isComplete = status === "complete";
            const isWarning = status === "warning";
            const isLast = lineCards[lineCards.length - 1]?.line.id === line.id;

            return (
              <div
                key={line.id}
                css={[
                  customStyles.rowSection,
                  !isLast && customStyles.rowSectionDivider,
                ]}
              >
                <div css={customStyles.rowHeader}>
                  <div
                    css={[
                      customStyles.statusIconWrap,
                      isComplete && customStyles.statusIconWrapComplete,
                      isWarning && customStyles.statusIconWrapWarning,
                    ]}
                    data-testid={`custom-line-${lineIndex}-status-icon`}
                    data-status={status}
                    aria-hidden="true"
                  >
                    {isComplete ? (
                      <CheckCircle2 size={18} />
                    ) : isWarning ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                  </div>

                  <span css={customStyles.lineDescriptionLabel}>{title}</span>
                </div>

                <div css={customStyles.fieldsGrid}>
                  {line.fields.map((field, fieldIndex) => {
                    const value = String(lineState.values[field.key] ?? "");
                    const isAnswered = isFieldAnswered(field, value);
                    const isDirty = Boolean(dirtyFieldsByLine[line.id]?.[field.key]);
                    const showFieldWarning =
                      field.required &&
                      !isAnswered &&
                      (status === "warning" || isDirty);
                    const readOnly = disabled || !isEditing;
                    const commonProps = {
                      disabled: readOnly,
                      placeholder: field.placeholder,
                    };
                    const fieldTestIdBase = `custom-line-${lineIndex}-field-${fieldIndex}`;

                    return (
                      <div
                        key={field.key}
                        css={[
                          customStyles.fieldCard,
                          field.component === "textarea" && customStyles.fieldCardWide,
                        ]}
                      >
                        <div css={customStyles.fieldTopRow}>
                          <label style={customStyles.fieldLabel}>
                            {field.label}
                            {field.required ? (
                              <span style={customStyles.requiredAsterisk}>*</span>
                            ) : null}
                          </label>
                        </div>
                        {!isEditing ? (
                          <div
                            css={customStyles.readonlyValueWrap}
                            data-testid={`${fieldTestIdBase}-readonly`}
                            style={
                              field.component === "textarea"
                                ? {
                                    ...customStyles.readonlyValue,
                                    ...customStyles.readonlyValueMultiline,
                                    ...(showFieldWarning ? customStyles.controlWarning : {}),
                                  }
                                : {
                                    ...customStyles.readonlyValue,
                                    ...(showFieldWarning ? customStyles.controlWarning : {}),
                                  }
                            }
                          >
                            {field.component === "checkbox"
                              ? value === "true"
                                ? "Si"
                                : value === "false"
                                  ? "No"
                                  : "-"
                              : value || "-"}
                          </div>
                        ) : field.component === "textarea" ? (
                          <textarea
                            {...commonProps}
                            data-testid={`${fieldTestIdBase}-input`}
                            rows={2}
                            value={value}
                            style={{
                              ...customStyles.textareaInput,
                              ...(showFieldWarning ? customStyles.controlWarning : {}),
                            }}
                            onChange={(e) =>
                              updateField(line.id, field.key, e.target.value)
                            }
                          />
                        ) : field.component === "select" ? (
                          <Autocomplete
                            options={(field.options ?? []).map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            value={value}
                            onChange={(nextValue) =>
                              updateField(line.id, field.key, nextValue)
                            }
                            placeholder={field.placeholder ?? "Seleccionar..."}
                            disabled={readOnly}
                            hideClearButton={false}
                            allowCustomValue={false}
                            dataTestId={`${fieldTestIdBase}-input`}
                            inputStyle={{
                              ...customStyles.autocompleteInput,
                              ...(showFieldWarning ? customStyles.controlWarning : {}),
                            }}
                          />
                        ) : field.component === "checkbox" ? (
                          <div css={customStyles.binaryChoiceRow}>
                            {[
                              { optionValue: "true", label: "Si" },
                              { optionValue: "false", label: "No" },
                            ].map((option) => {
                              const selected = value === option.optionValue;
                              return (
                                <button
                                  key={option.optionValue}
                                  type="button"
                                    data-testid={`${fieldTestIdBase}-option-${option.optionValue}`}
                                  disabled={readOnly}
                                  aria-pressed={selected}
                                  css={[
                                    customStyles.binaryChoiceButton,
                                    showFieldWarning && customStyles.binaryChoiceButtonWarning,
                                    selected && customStyles.binaryChoiceButtonSelected,
                                  ]}
                                  onClick={() =>
                                    updateField(
                                      line.id,
                                      field.key,
                                      selected ? "" : option.optionValue
                                    )
                                  }
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            {...commonProps}
                            data-testid={`${fieldTestIdBase}-input`}
                            type={field.component === "text" ? "text" : "number"}
                            inputMode={field.component === "text" ? "text" : "decimal"}
                            value={value}
                            style={{
                              ...customStyles.input,
                              ...(showFieldWarning ? customStyles.controlWarning : {}),
                            }}
                            onChange={(e) =>
                              updateField(line.id, field.key, e.target.value)
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </LineasSectionShell>
  );
}

const customStyles = {
  listCard: css({
    padding: "8px 10px",
  }),
  summaryRow: css({
    padding: "2px 2px 8px",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 2,
  }),
  summaryValue: css({
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
  }),
  rowsList: css({
    display: "flex",
    flexDirection: "column",
    width: "100%",
  }),
  rowSection: css({
    width: "100%",
    padding: "8px 2px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }),
  rowSectionDivider: css({
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  rowHeader: css({
    display: "flex",
    alignItems: "center",
    gap: 5,
    width: "100%",
  }),
  statusIconWrap: css({
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    color: COLOR.TEXT.SECONDARY,
  }),
  statusIconWrapComplete: css({
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  statusIconWrapWarning: css({
    color: COLOR.SEMANTIC.WARNING,
  }),
  headerCostoInput: {
    width: 120,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "6px 8px",
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 700,
    textAlign: "right" as const,
  },
  headerCostoValue: {
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 700,
    fontSize: 16,
  },
  headerEditIconButton: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 6,
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  fieldCard: css({
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  }),
  fieldCardWide: css({
    gridColumn: "span 2",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridColumn: "span 1",
    },
  }),
  fieldTopRow: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  }),
  fieldLabel: {
    fontSize: 10,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  readonlyValue: {
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "7px 10px",
    minHeight: 34,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    display: "flex",
    alignItems: "center",
  },
  readonlyValueWrap: css({
    width: "100%",
  }),
  requiredAsterisk: {
    color: COLOR.ICON.DANGER,
    marginLeft: 3,
  },
  input: {
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "7px 10px",
    minHeight: 34,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 13,
  },
  controlWarning: {
    borderColor: COLOR.SEMANTIC.WARNING,
  },
  textareaInput: {
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "7px 10px",
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    minHeight: 46,
    resize: "vertical" as const,
    lineHeight: 1.4,
    fontSize: 13,
  },
  autocompleteInput: {
    padding: "7px 40px 7px 10px",
    minHeight: 34,
    height: 34,
    fontSize: 13,
  },
  binaryChoiceRow: css({
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  }),
  binaryChoiceButton: css({
    minWidth: 50,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }),
  binaryChoiceButtonWarning: css({
    borderColor: COLOR.SEMANTIC.WARNING,
  }),
  binaryChoiceButtonSelected: css({
    background: COLOR.BACKGROUND.INFO_TINT,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.ACCENT.PRIMARY,
  }),
  readonlyValueMultiline: {
    alignItems: "flex-start" as const,
    minHeight: 46,
    lineHeight: 1.4,
  },
  lineDescriptionLabel: css({
    display: "inline-flex",
    fontSize: 13,
    lineHeight: 1.25,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),
} as const;
