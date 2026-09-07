"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, ReceiptText } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import FacturaListItem from "@/app/components/facturacion/FacturaListItem";
import FacturasFiltersModal, { type FacturasFilters } from "@/app/components/facturacion/FacturasFiltersModal";
import FacturasToolbar, { type FacturaDocumentoTipoFilter, type FacturaFilterChip } from "@/app/components/facturacion/FacturasToolbar";
import {
  FACTURA_ESTADO_LABEL,
  type FacturaElectronicaEstado,
  type FacturasPaginadas,
} from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";

const initialFilters: FacturasFilters = {
  estado: "", ambiente: "", documentoTipo: "", desde: "", hasta: "",
};

function isFilterKey(value: string): value is keyof FacturasFilters {
  return value in initialFilters;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR").format(new Date(`${value}T12:00:00`));
}

export default function FacturacionPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [applied, setApplied] = useState<FacturasFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<FacturasPaginadas>({ items: [], page: 1, pageSize: 25, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), pageSize: "25" });
    Object.entries({ ...applied, search: deferredSearch }).forEach(([key, item]) => { if (item) value.set(key, item); });
    return value;
  }, [applied, deferredSearch, page]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/facturas?${params}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar los comprobantes");
      setResult(body.data);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los comprobantes");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const exportUrl = (format: "csv" | "xlsx") => {
    const query = new URLSearchParams(params);
    query.delete("page");
    query.delete("pageSize");
    query.set("format", format);
    return `/api/facturas/export?${query}`;
  };

  const applyFilters = (filters: FacturasFilters) => {
    setPage(1);
    setApplied(filters);
  };

  const filterChips = useMemo<FacturaFilterChip[]>(() => {
    const chips: FacturaFilterChip[] = [];
    if (applied.estado) chips.push({ key: "estado", text: `Estado: ${FACTURA_ESTADO_LABEL[applied.estado as FacturaElectronicaEstado]}` });
    if (applied.ambiente) chips.push({ key: "ambiente", text: applied.ambiente === "PRODUCCION" ? "Producción" : "Homologación" });
    if (applied.desde) chips.push({ key: "desde", text: `Desde ${formatDate(applied.desde)}` });
    if (applied.hasta) chips.push({ key: "hasta", text: `Hasta ${formatDate(applied.hasta)}` });
    return chips;
  }, [applied]);

  const removeFilterChip = (key: string) => {
    if (!isFilterKey(key)) return;
    setPage(1);
    setApplied((current) => ({ ...current, [key]: "" }));
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <ScreenHeader
        title="Facturas emitidas"
        subtitle="Consultá todos los comprobantes fiscales, su estado en ARCA y el detalle que quedó registrado."
      />

      <FacturasToolbar
        search={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onOpenFilters={() => setFiltersOpen(true)}
        documentoTipo={applied.documentoTipo as FacturaDocumentoTipoFilter}
        onDocumentoTipoChange={(documentoTipo) => {
          setPage(1);
          setApplied((current) => ({ ...current, documentoTipo }));
        }}
        chips={filterChips}
        onRemoveChip={removeFilterChip}
        onClearFilters={() => { setApplied(initialFilters); setPage(1); }}
      />

      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.heading}>Comprobantes</h2>
          <span style={styles.count}>{result.total} documento{result.total === 1 ? "" : "s"}</span>
        </div>
        <div style={styles.exportActions}>
          <a href={exportUrl("csv")} style={styles.exportLink}><Download size={16} /> CSV</a>
          <a href={exportUrl("xlsx")} style={styles.exportLink}><FileSpreadsheet size={16} /> Excel</a>
        </div>
      </div>

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}
      {loading ? <ListSkeleton rows={7} /> : null}
      {!loading && result.items.length === 0 ? (
        <Card style={styles.empty}>
          <ReceiptText size={34} color={COLOR.TEXT.TERTIARY} />
          <strong>No hay comprobantes para estos filtros</strong>
          <span>Cuando se emita una factura aparecerá acá con todo su historial.</span>
        </Card>
      ) : null}
      {!loading && result.items.length ? (
        <div style={styles.list}>
          {result.items.map((invoice) => {
            return <FacturaListItem key={invoice.id} invoice={invoice} />;
          })}
        </div>
      ) : null}

      {!loading && result.total > result.pageSize ? (
        <nav style={styles.pagination} aria-label="Paginación de comprobantes">
          <Button text="Anterior" outline disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} hideTextOnMobile={false} />
          <span>Página {page} de {totalPages}</span>
          <Button text="Siguiente" outline disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} hideTextOnMobile={false} />
        </nav>
      ) : null}

      <FacturasFiltersModal
        open={filtersOpen}
        initial={applied}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" as const },
  heading: { margin: 0, fontSize: 20 }, count: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  exportActions: { display: "flex", gap: 8 },
  exportLink: { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: COLOR.TEXT.PRIMARY, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column" as const, gap: 9 },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 20, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  empty: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, padding: 36, textAlign: "center" as const, color: COLOR.TEXT.SECONDARY },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginBottom: 12 },
} as const;
