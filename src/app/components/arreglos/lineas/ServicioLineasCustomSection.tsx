"use client";

import React, { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Check, LibraryBig, Pencil } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import type { ServicioLinea } from "./ServicioLineasEditableSection";
import type { ArregloFormularioLineaValue } from "@/app/api/arreglos/arregloRequests";
import LineasSectionShell from "./LineasSectionShell";
import Card from "../../ui/Card";
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
    const value = String(state.values[field.key] ?? "").trim();
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
    () => makeInitialState(lineDefs, initialDetalle?.metadata)
  );

  useEffect(() => {
    setIsEditing(editableOnLoad);
    setStateByLine(makeInitialState(lineDefs, initialDetalle?.metadata));
    setFormCostoInput(
      String(
        Number.isFinite(Number(initialDetalle?.costo))
          ? Number(initialDetalle?.costo)
          : Number.isFinite(Number(defaultCosto))
            ? Number(defaultCosto)
            : 0
      )
    );
  }, [lineDefs, defaultCosto, initialDetalle, editableOnLoad]);

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
      <div style={lineaStyles.list}>
        {lineDefs.length === 0 ? (
          <div style={lineaStyles.emptyState}>Sin lineas custom configuradas.</div>
        ) : null}

        {lineDefs.map((line) => {
          const lineState = stateByLine[line.id] ?? { values: {} };

          return (
            <Card key={line.id} css={customStyles.card}>
              <div css={customStyles.body}>
                <div css={customStyles.topWrap}>
                  {isEditing ? (
                    <input
                      css={customStyles.titleInput}
                      value={String(lineState.values.__titulo ?? line.title ?? line.descripcion)}
                      onChange={(e) =>
                        updateField(line.id, "__titulo", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Titulo"
                    />
                  ) : (
                    <div css={customStyles.titleReadonly}>
                      {String(lineState.values.__titulo ?? line.title ?? line.descripcion).trim() ||
                        line.title ||
                        line.descripcion}
                    </div>
                  )}

                  <div style={customStyles.fieldsGrid}>
                    {line.fields.map((field) => {
                      const value = String(lineState.values[field.key] ?? "");
                      const commonProps = {
                        disabled,
                        placeholder: field.placeholder,
                      };

                      return (
                        <div key={field.key} style={customStyles.fieldWrap}>
                          <label style={customStyles.fieldLabel}>
                            {field.label}
                            {field.required ? (
                              <span style={customStyles.requiredAsterisk}>*</span>
                            ) : null}
                          </label>
                          {!isEditing ? (
                            <div style={customStyles.readonlyValue}>
                              {field.component === "checkbox"
                                ? value === "true"
                                  ? "Si"
                                  : "No"
                                : value || "-"}
                            </div>
                          ) : field.component === "textarea" ? (
                            <textarea
                              {...commonProps}
                              rows={2}
                              value={value}
                              style={customStyles.input}
                              onChange={(e) =>
                                updateField(line.id, field.key, e.target.value)
                              }
                            />
                          ) : field.component === "select" ? (
                            <select
                              disabled={disabled}
                              value={value}
                              style={customStyles.input}
                              onChange={(e) =>
                                updateField(line.id, field.key, e.target.value)
                              }
                            >
                              <option value="">Seleccionar...</option>
                              {(field.options ?? []).map((option) => (
                                <option
                                  key={`${field.key}-${option.value}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : field.component === "checkbox" ? (
                            <div style={customStyles.checkboxRow}>
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={value === "true"}
                                onChange={(e) =>
                                  updateField(
                                    line.id,
                                    field.key,
                                    e.target.checked ? "true" : "false"
                                  )
                                }
                              />
                              <span style={customStyles.checkboxText}>
                                {value === "true" ? "Si" : "No"}
                              </span>
                            </div>
                          ) : (
                            <input
                              {...commonProps}
                              type={field.component === "text" ? "text" : "number"}
                              inputMode={field.component === "text" ? "text" : "decimal"}
                              value={value}
                              style={customStyles.input}
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
              </div>
            </Card>
          );
        })}
      </div>
    </LineasSectionShell>
  );
}

const customStyles = {
  card: css({
    ...lineaStyles.itemCard,
    gap: 10,
    alignItems: "center",
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flexWrap: "nowrap",
    },
  }),
  body: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
  }),
  topWrap: css({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 8,
    width: "100%",
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "column",
      alignItems: "stretch",
      flexWrap: "nowrap",
    },
  }),
  titleInput: css({
    ...lineaStyles.editorInput,
    width: 300,
    minWidth: 300,
    textAlign: "left",
    fontWeight: 700,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      minWidth: 0,
    },
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
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldsGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "flex-start",
    gap: 10,
    width: "auto",
    flex: 1,
    minWidth: 0,
    [`@media (maxWidth: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      flexDirection: "column" as const,
      alignItems: "stretch",
      gap: 8,
    },
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column" as const,
    flex: "1 1 220px",
    minWidth: 180,
    maxWidth: "100%",
    gap: 4,
    [`@media (maxWidth: ${BREAKPOINTS.md}px)`]: {
      flex: "1 1 100%",
      minWidth: 0,
      width: "100%",
    },
  },
  fieldLabel: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  titleReadonly: css({
    width: 300,
    minWidth: 300,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      minWidth: 0,
      whiteSpace: "normal",
    },
  }),
  readonlyValue: {
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "8px 10px",
    minHeight: 38,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    display: "flex",
    alignItems: "center",
  },
  requiredAsterisk: {
    color: COLOR.ICON.DANGER,
    marginLeft: 3,
  },
  input: {
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "8px 10px",
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  checkboxRow: {
    height: 38,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  checkboxText: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 600,
  },
  footer: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingTop: 8,
    marginTop: 4,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      width: "auto",
      minWidth: 140,
      flexShrink: 0,
      justifyContent: "flex-end",
      borderTop: "none",
      paddingTop: 0,
      marginTop: 0,
    },
  }),
  previewTotal: {
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: "nowrap" as const,
  },
} as const;
