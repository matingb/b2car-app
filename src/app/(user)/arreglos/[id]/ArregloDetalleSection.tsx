import React from "react";
import { COLOR } from "@/theme/theme";
import IconLabel from "@/app/components/ui/IconLabel";
import ArregloDetalleLineasList, {
  type ArregloDetalleLineaSectionItem,
} from "./ArregloDetalleLineasList";
import { formatArs } from "@/lib/format";

type Props = {
  title: React.ReactNode;
  titleIcon: React.ReactNode;
  emptyText: string;
  items: ArregloDetalleLineaSectionItem[];
  itemIcon: React.ReactNode;
  variant: "servicios" | "repuestos";
};

export default function ArregloDetalleSection({
  title,
  titleIcon,
  emptyText,
  items,
  itemIcon,
  variant,
}: Props) {
  const subtotalValue = items.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const subtotal = formatArs(subtotalValue, { maxDecimals: 0, minDecimals: 0 });

  return (
    <div>
      <div style={styles.sectionTitle}>
        <IconLabel icon={titleIcon} label={title} />
      </div>

      <ArregloDetalleLineasList
        emptyText={emptyText}
        items={items}
        variant={variant}
        itemIcon={itemIcon}
      />

      <div style={styles.subtotalRow}>
        <span style={styles.subtotalLabel}>Subtotal</span>
        <span style={styles.subtotalValue}>{subtotal}</span>
      </div>
    </div>
  );
}

const styles = {
  sectionTitle: {
    paddingTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 10,
  },
  subtotalRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 8,
  },
  subtotalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 700,
  },
  subtotalValue: {
    fontWeight: 800,
    fontSize: 16,
    color: COLOR.ACCENT.PRIMARY,
  },
} as const;