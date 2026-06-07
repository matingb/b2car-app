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

    const rows = extraRows
        ? extraRows
              .filter(({ key }) => Number(nested[key] ?? 0) !== 0)
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
                <div className="text-foreground mb-1 text-sm font-semibold">
                    {String(nested[titleKey] ?? "")}
                </div>
            )}
            {rows.map(({ key, label, formatted, color }) => (
                <div key={key} className="flex items-center gap-1.5 text-muted-foreground">
                    {color && (
                        <span
                            style={{ backgroundColor: color }}
                            className="inline-block size-2 shrink-0"
                        />
                    )}
                    {label}:{" "}
                    <span className="text-foreground font-medium">{formatted}</span>
                </div>
            ))}
        </div>
    );
}
