"use client";

interface Entry {
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    stroke?: string;
    payload?: Record<string, unknown>;
}

interface ExtraRow {
    key: string;
    label: string;
    formatter?: (value: unknown) => string;
}

interface GraficoTooltipProps {
    active?: boolean;
    payload?: Entry[];
    title?: string | null;
    titleKey?: string;
    labelMap?: Record<string, string>;
    formatter?: (value: number, name: string) => string;
    extraRows?: ExtraRow[];
}

export default function GraficoTooltip({
    active,
    payload,    
    titleKey,
    labelMap,
    formatter,
    extraRows,
}: GraficoTooltipProps) {
    if (!active || !payload?.length) return null;

    const nested = payload[0]?.payload ?? {};
    const sliceColor =
        payload[0]?.color ??
        payload[0]?.fill ??
        payload[0]?.stroke ??
        (nested.fill as string | undefined) ??
        (nested.color as string | undefined);

    const rows = extraRows
        ? extraRows
              .filter(({ key }) => nested[key] !== undefined && nested[key] !== null)
              .map(({ key, label, formatter: fmt }) => ({
                  key,
                  label,
                  formatted: fmt ? fmt(nested[key]) : String(nested[key] ?? ""),
                  color: undefined,
              }))
        : payload
              .filter((entry) => Number(entry.value ?? 0) !== 0)
              .map((entry) => {
                  const name = entry.name ?? "";
                  const value = Number(entry.value ?? 0);
                  return {
                      key: name,
                      label: labelMap?.[name] ?? name,
                      formatted: formatter ? formatter(value, name) : String(value),
                      color: entry.color ?? entry.fill ?? entry.stroke,
                  };
              });

    if (rows.length === 0) return null;

    return (
        <div className="border-border/50 bg-background min-w-[12rem] rounded-lg border px-3 py-2 text-xs shadow-xl">
            {titleKey && (
                <div className="text-foreground mb-1.5 text-sm font-semibold flex items-center gap-2">
                    {sliceColor && (
                        <span
                            style={{ backgroundColor: sliceColor }}
                            className="inline-block size-3 rounded-[3px] shrink-0 border border-black/10 shadow-sm"
                        />
                    )}
                    <span>{String(nested[titleKey] ?? "")}</span>
                </div>
            )}
            {rows.map(({ key, label, formatted, color }) => (
                <div key={key} className="flex items-center gap-2 text-muted-foreground py-0.5">
                    {!titleKey && (color || sliceColor) && (
                        <span
                            style={{ backgroundColor: color || sliceColor }}
                            className="inline-block size-2.5 rounded-[2px] shrink-0 border border-black/10"
                        />
                    )}
                    <span>{label}:</span>{" "}
                    <span className="text-foreground font-medium ml-auto">{formatted}</span>
                </div>
            ))}
        </div>
    );
}
