import type { ArregloFormularioLineaValue } from "@/app/api/arreglos/arregloRequests";

type RawRecord = Record<string, unknown>;

type ParsedField = {
  key: string;
  label: string;
  required: boolean;
};

type ParsedLine = {
  title: string;
  fields: ParsedField[];
};

type RequiredFieldRef = {
  lineIndex: number;
  lineTitle: string;
  fieldLabel: string;
  aliases: string[];
};

type ParsedDetailInput = {
  normalizedTitle: string;
  value: unknown;
};

type ParsedDetailLine = {
  normalizedTitle: string;
  inputs: ParsedDetailInput[];
};

const TERMINADO_REQUIRED_ERROR_PREFIX =
  "Faltan completar campos oblibatorios del formulario";

function asRecord(input: unknown): RawRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as RawRecord;
}

function normalizeToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueNormalizedTokens(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function parseFields(raw: unknown): ParsedField[] {
  if (!Array.isArray(raw)) return [];

  const out: ParsedField[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const record = asRecord(raw[index]);
    if (!record) continue;

    const key = String(
      record.key ?? record.name ?? record.title ?? record.label ?? `field_${index + 1}`
    ).trim();
    if (!key) continue;

    const label = String(record.label ?? record.title ?? key).trim() || key;

    out.push({
      key,
      label,
      required: Boolean(record.required),
    });
  }

  return out;
}

function parseAsObjectLines(metadata: unknown): ParsedLine[] {
  if (!Array.isArray(metadata)) return [];

  const out: ParsedLine[] = [];
  for (let i = 0; i < metadata.length; i += 1) {
    const row = asRecord(metadata[i]);
    if (!row) continue;

    const title = String(
      row.title ?? row.titulo ?? row.descripcion ?? `Linea ${i + 1}`
    ).trim();
    const inputs = Array.isArray(row.inputs) ? row.inputs : [];

    out.push({
      title: title || `Linea ${i + 1}`,
      fields: parseFields(inputs),
    });
  }

  return out;
}

function parseAsNestedLines(metadata: unknown): ParsedLine[] {
  if (!Array.isArray(metadata)) return [];

  const out: ParsedLine[] = [];
  for (let i = 0; i < metadata.length; i += 1) {
    const lineRaw = metadata[i];
    if (!Array.isArray(lineRaw)) continue;

    const firstWithTitle = lineRaw
      .map((entry) => asRecord(entry))
      .find((entry) => {
        const title = String(entry?.title ?? entry?.titulo ?? "").trim();
        return title.length > 0;
      });

    const title = String(firstWithTitle?.title ?? firstWithTitle?.titulo ?? "").trim();
    out.push({
      title: title || `Linea ${i + 1}`,
      fields: parseFields(lineRaw),
    });
  }

  return out;
}

function parseAsFallbackLines(metadata: unknown): ParsedLine[] {
  const metadataRecord = asRecord(metadata);
  const sourceArray = Array.isArray(metadata)
    ? metadata
    : Array.isArray(metadataRecord?.lineas)
      ? (metadataRecord?.lineas as unknown[])
      : [];

  const out: ParsedLine[] = [];
  for (let i = 0; i < sourceArray.length; i += 1) {
    const row = asRecord(sourceArray[i]);
    if (!row) continue;

    const title = String(
      row.title ??
        row.titulo ??
        row.descripcion ??
        row.nombre ??
        `Servicio custom ${i + 1}`
    ).trim();

    out.push({
      title: title || `Servicio custom ${i + 1}`,
      fields: parseFields(row.fields ?? row.componentes),
    });
  }

  return out;
}

function parseCustomLines(metadata: unknown): ParsedLine[] {
  const objectLines = parseAsObjectLines(metadata);
  if (objectLines.length > 0) return objectLines;

  const nestedLines = parseAsNestedLines(metadata);
  if (nestedLines.length > 0) return nestedLines;

  return parseAsFallbackLines(metadata);
}

export function extractRequiredCustomFormFields(formMetadata: unknown): Array<{
  lineTitle: string;
  fieldLabel: string;
}> {
  const parsed = parseCustomLines(formMetadata);
  const refs: RequiredFieldRef[] = [];

  for (let lineIndex = 0; lineIndex < parsed.length; lineIndex += 1) {
    const line = parsed[lineIndex];
    for (const field of line.fields) {
      if (!field.required) continue;
      refs.push({
        lineIndex,
        lineTitle: line.title,
        fieldLabel: field.label,
        aliases: uniqueNormalizedTokens([field.label, field.key]),
      });
    }
  }

  return refs.map((ref) => ({
    lineTitle: ref.lineTitle,
    fieldLabel: ref.fieldLabel,
  }));
}

function parseDetalleLineas(metadata: unknown): ParsedDetailLine[] {
  if (!Array.isArray(metadata)) return [];

  const out: ParsedDetailLine[] = [];

  for (let i = 0; i < metadata.length; i += 1) {
    const row = asRecord(metadata[i]);
    if (!row) continue;

    const lineTitle = normalizeToken(row.title ?? `linea_${i + 1}`);
    const inputsRaw = Array.isArray(row.inputs) ? row.inputs : [];
    const inputs: ParsedDetailInput[] = [];

    for (const inputRaw of inputsRaw) {
      const input = asRecord(inputRaw);
      if (!input) continue;
      inputs.push({
        normalizedTitle: normalizeToken(input.title),
        value: input.value,
      });
    }

    out.push({
      normalizedTitle: lineTitle,
      inputs,
    });
  }

  return out;
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return String(value).trim().length > 0;
}

function findInputValue(line: ParsedDetailLine | undefined, aliases: string[]): unknown {
  if (!line) return undefined;
  const aliasSet = new Set(aliases);
  const found = line.inputs.find((input) => aliasSet.has(input.normalizedTitle));
  return found?.value;
}

export function findMissingRequiredCustomFormFields(params: {
  formMetadata: unknown;
  detalleMetadata: ArregloFormularioLineaValue[] | null | undefined;
}): string[] {
  const parsed = parseCustomLines(params.formMetadata);
  const requiredRefs: RequiredFieldRef[] = [];

  for (let lineIndex = 0; lineIndex < parsed.length; lineIndex += 1) {
    const line = parsed[lineIndex];
    for (const field of line.fields) {
      if (!field.required) continue;
      requiredRefs.push({
        lineIndex,
        lineTitle: line.title,
        fieldLabel: field.label,
        aliases: uniqueNormalizedTokens([field.label, field.key]),
      });
    }
  }

  if (requiredRefs.length === 0) return [];

  const detalleLineas = parseDetalleLineas(params.detalleMetadata);
  const missing: string[] = [];

  for (const ref of requiredRefs) {
    const byIndex = detalleLineas[ref.lineIndex];
    let value = findInputValue(byIndex, ref.aliases);

    if (value === undefined) {
      const normalizedLineTitle = normalizeToken(ref.lineTitle);
      const byTitle = detalleLineas.find((line) => line.normalizedTitle === normalizedLineTitle);
      value = findInputValue(byTitle, ref.aliases);
    }

    if (hasValue(value)) continue;

    const missingLabel = ref.lineTitle
      ? `${ref.lineTitle}: ${ref.fieldLabel}`
      : ref.fieldLabel;
    missing.push(missingLabel);
  }

  return Array.from(new Set(missing));
}

export function buildTerminadoRequiredFieldsErrorMessage(
  missingFields: string[]
): string {
  if (missingFields.length === 0) return TERMINADO_REQUIRED_ERROR_PREFIX;
  return `${TERMINADO_REQUIRED_ERROR_PREFIX}: ${missingFields.join(", ")}`;
}

