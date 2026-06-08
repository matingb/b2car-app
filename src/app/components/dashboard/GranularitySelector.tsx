"use client";

import {
  type Granularity,
  GRANULARITY_LABELS,
} from "@/lib/dashboard/aggregation";
import Dropdown from "../ui/Dropdown";

type Props = {
  value: Granularity;
  onChange: (g: Granularity) => void;
};

const OPTIONS: Granularity[] = ["day", "week", "month"];

export default function GranularitySelector({ value, onChange }: Props) {
  return (
    <Dropdown
      style={styles.dropdown}
      options={OPTIONS.map((g) => ({ value: g, label: GRANULARITY_LABELS[g] }))}
      value={value}
      onChange={(g) => onChange(g as Granularity)}
    />
  );
}

const styles = {
  dropdown: {
    position: "relative" as const,
    height: "35px",
    width: "120px",
  },
} as const;
