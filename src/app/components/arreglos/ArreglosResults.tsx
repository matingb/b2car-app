"use client";

import type { Arreglo } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COLOR } from "@/theme/theme";

const LOADING_MORE_SPINNER_MIN_MS = 1000;

type Props = {
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  items: Arreglo[];
  onSelect: (arreglo: Arreglo) => void;
};

export default function ArreglosResults({
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  items,
  onSelect,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [showLoadingMoreSpinner, setShowLoadingMoreSpinner] = useState(false);
  const loadingMoreStartedAtRef = useRef<number | null>(null);
  const minSpinnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loadingMore) {
      loadingMoreStartedAtRef.current ??= Date.now();
      setShowLoadingMoreSpinner(true);
      if (minSpinnerTimeoutRef.current) {
        clearTimeout(minSpinnerTimeoutRef.current);
        minSpinnerTimeoutRef.current = null;
      }
      return;
    }
    const startedAt = loadingMoreStartedAtRef.current;
    loadingMoreStartedAtRef.current = null;
    if (startedAt == null) {
      setShowLoadingMoreSpinner(false);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const remaining = LOADING_MORE_SPINNER_MIN_MS - elapsed;
    if (remaining <= 0) {
      setShowLoadingMoreSpinner(false);
      return;
    }
    minSpinnerTimeoutRef.current = setTimeout(() => {
      minSpinnerTimeoutRef.current = null;
      setShowLoadingMoreSpinner(false);
    }, remaining);
    return () => {
      if (minSpinnerTimeoutRef.current) {
        clearTimeout(minSpinnerTimeoutRef.current);
        minSpinnerTimeoutRef.current = null;
      }
    };
  }, [loadingMore]);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loading || loadingMore) return;
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: null, rootMargin: "300px 0px", threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  if (loading) return <ListSkeleton rows={6} />;

  return (
    <div style={styles.listContainer} data-testid="arreglos-results">
      {items.map((arreglo) => (
        <div key={arreglo.id} data-testid={`arreglo-item-${arreglo.id}`}>
          <ArregloItem arreglo={arreglo} onClick={onSelect} />
        </div>
      ))}
      {hasMore ? <div ref={sentinelRef} style={styles.sentinel} data-testid="arreglos-load-more-sentinel" /> : null}
      {showLoadingMoreSpinner ? (
        <div style={styles.loadingMore} data-testid="arreglos-load-more-spinner">
          <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
          <span style={styles.loadingMoreLabel}>Cargando más arreglos...</span>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  listContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  sentinel: {
    height: 1,
  },
  loadingMore: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "16px 0",
  },
  loadingMoreLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
} as const;


