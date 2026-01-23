"use client";

import React from "react";
import type { StockItem } from "@/model/stock";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import StockItemCard from "./StockItemCard";

type Props = {
  loading: boolean;
  items: StockItem[];
  onSelect: (item: StockItem) => void;
};

export default function StockResults({ loading, items, onSelect }: Props) {
  if (loading) return <ListSkeleton rows={6} />;

  return (
    <div style={styles.list} data-testid="stock-results">
      {items.map((item) => (
        <StockItemCard key={item.id} item={item} onClick={onSelect} />
      ))}
    </div>
  );
}

const styles = {
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
  },
} as const;

