"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { BadgeMinus, BadgePlus, Download, FileSpreadsheet, FileText, ReceiptText } from "lucide-react";
import Color from "color";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import FacturasFiltersModal, { type FacturasFilters } from "@/app/components/facturacion/FacturasFiltersModal";
import FacturasToolbar, { type FacturaDocumentoTipoFilter, type FacturaFilterChip } from "@/app/components/facturacion/FacturasToolbar";
import {
  FACTURA_ESTADO_LABEL,
  comprobanteLabel,
  type FacturaElectronicaEstado,
  type FacturaElectronicaResumen,
  type FacturasPaginadas,
} from "@/lib/facturacion/types";
import { COLOR } from "@/theme/theme";

const initialFilters: FacturasFilters = {
  estado: "", ambiente: "", documentoTipo: "", desde: "", hasta: "",
};

function isFilterKey(value: string): value is keyof FacturasFilters {
  return value in initialFilters;
}

const documentPresentation = {
  FACTURA: {
    icon: <FileText size={20} />,
    color: COLOR.ACCENT.PRIMARY,
    background: Color(COLOR.ACCENT.PRIMARY).alpha(0.12).toString(),
  },
  NOTA_CREDITO: {
    icon: <BadgeMinus size={20} />,
    color: COLOR.SEMANTIC.DANGER,
    background: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
  },
  NOTA_DEBITO: {
    icon: <BadgePlus size={20} />,
    color: COLOR.SEMANTIC.WARNING,
    background: Color(COLOR.SEMANTIC.WARNING).alpha(0.14).toString(),
  },
} as const;

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR").format(new Date(`${value}T12:00:00`));
}

function voucherNumber(invoice: FacturaElectronicaResumen) {
  if (!invoice.numeroComprobante) return "Sin número";
  return `${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante).padStart(8, "0")}`;
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
            const presentation = documentPresentation[invoice.documentoTipo];
            return (
              <Link href={`/facturacion/${invoice.id}`} key={invoice.id} style={styles.invoiceLink}>
                <Card style={styles.invoiceCard}>
                  <div style={styles.invoiceMain}>
                    <div style={{ ...styles.icon, color: presentation.color, background: presentation.background }}>{presentation.icon}</div>
                  <div style={styles.invoiceIdentity}>
                    <div style={styles.invoiceTitle}>
                      <strong>{comprobanteLabel(invoice.documentoTipo, invoice.claseComprobante)}</strong>
                      <span style={statusStyle(invoice.estado)}>{FACTURA_ESTADO_LABEL[invoice.estado]}</span>
                    </div>
                    <span style={styles.number}>{voucherNumber(invoice)}</span>
                    <span style={styles.meta}>{invoice.receptorNombre} · {invoice.receptorDocumento || "Sin documento"}</span>
                  </div>
                </div>
                <div style={styles.invoiceData}>
                  <span>{formatDate(invoice.fechaComprobante)}</span>
                  <strong>{formatMoney(invoice.total)}</strong>
                  <small>{invoice.ambiente === "PRODUCCION" ? "Producción" : "Homologación"}</small>
                </div>
              </Card>
            </Link>
            );
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

function statusStyle(status: FacturaElectronicaEstado): React.CSSProperties {
  const palette = status === "AUTORIZADA"
    ? { color: COLOR.SEMANTIC.SUCCESS, background: COLOR.BACKGROUND.SUCCESS_TINT }
    : status === "RECHAZADA"
      ? { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT }
      : { color: COLOR.TEXT.SECONDARY, background: COLOR.BACKGROUND.SUBTLE };
  return { ...styles.status, ...palette };
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" as const },
  heading: { margin: 0, fontSize: 20 }, count: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  exportActions: { display: "flex", gap: 8 },
  exportLink: { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: COLOR.TEXT.PRIMARY, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column" as const, gap: 9 },
  invoiceLink: { textDecoration: "none", color: "inherit" },
  invoiceCard: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, transition: "border-color .15s ease" },
  invoiceMain: { display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: "1 1 420px" },
  icon: { width: 42, height: 42, borderRadius: 10, background: COLOR.BACKGROUND.SUBTLE, color: COLOR.ACCENT.PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  invoiceIdentity: { display: "flex", flexDirection: "column" as const, gap: 3, minWidth: 0 },
  invoiceTitle: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  number: { fontFamily: "monospace", color: COLOR.TEXT.PRIMARY, fontSize: 13 },
  meta: { color: COLOR.TEXT.SECONDARY, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  status: { borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const },
  invoiceData: { display: "grid", gridTemplateColumns: "110px minmax(110px, auto)", gap: "3px 18px", textAlign: "right" as const, alignItems: "center" },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 20, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  empty: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, padding: 36, textAlign: "center" as const, color: COLOR.TEXT.SECONDARY },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginBottom: 12 },
} as const;
