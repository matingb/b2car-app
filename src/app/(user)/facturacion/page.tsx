"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { css } from "@emotion/react";
import { Download, FileSpreadsheet, Plus, ReceiptText } from "lucide-react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import FilterChip from "@/app/components/ui/FilterChip";
import FacturaListItem from "@/app/components/facturacion/FacturaListItem";
import FacturasFiltersModal, { type FacturasFilters } from "@/app/components/facturacion/FacturasFiltersModal";
import FacturasToolbar, { type FacturaDocumentoTipoFilter, type FacturaFilterChip } from "@/app/components/facturacion/FacturasToolbar";
import RemitoListItem from "@/app/components/remitos/RemitoListItem";
import RemitoCreateModal from "@/app/components/remitos/RemitoCreateModal";
import { useTenant } from "@/app/providers/TenantProvider";
import { documentosClient } from "@/clients/documentosClient";
import type { DocumentosPaginados } from "@/lib/documentos/types";
import {
  FACTURA_ESTADO_LABEL,
  type FacturaElectronicaEstado,
} from "@/lib/facturacion/types";
import { Permission } from "@/lib/permissions";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import { formatCalendarDateLabel } from "@/lib/fechas";

const initialFilters: FacturasFilters = {
  estado: "", ambiente: "", documentoTipo: "", desde: "", hasta: "",
};

const TIPOS: readonly FacturaDocumentoTipoFilter[] = ["", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO", "REMITO"];

type ClaseFiltro = "" | "R" | "X";
type FacturaAsociadaFiltro = "" | "con" | "sin";

function isFilterKey(value: string): value is keyof FacturasFilters {
  return value in initialFilters;
}

function parseTipo(value: string | null): FacturaDocumentoTipoFilter {
  return TIPOS.find((tipo) => tipo === value) ?? "";
}

function formatDate(value: string) {
  return formatCalendarDateLabel(value, "-");
}

/** Documentos: listado unificado de facturas, notas de crédito/débito y remitos. */
export default function DocumentacionPage() {
  return (
    <Suspense>
      <DocumentacionContent />
    </Suspense>
  );
}

function DocumentacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useTenant();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [applied, setApplied] = useState<FacturasFilters>(() => ({
    ...initialFilters,
    documentoTipo: parseTipo(searchParams.get("tipo")),
  }));
  const [clase, setClase] = useState<ClaseFiltro>("");
  const [facturaAsociada, setFacturaAsociada] = useState<FacturaAsociadaFiltro>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createRemitoOpen, setCreateRemitoOpen] = useState(false);
  const [result, setResult] = useState<DocumentosPaginados>({ items: [], page: 1, pageSize: 25, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tipo = parseTipo(applied.documentoTipo);
  const soloRemitos = tipo === "REMITO";

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await documentosClient.list({
        page,
        pageSize: 25,
        tipo,
        estado: soloRemitos ? "" : applied.estado,
        ambiente: applied.ambiente,
        desde: applied.desde,
        hasta: applied.hasta,
        search: deferredSearch,
        clase: soloRemitos ? clase : "",
        factura: soloRemitos ? facturaAsociada : "",
      }, signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los documentos");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [applied, clase, deferredSearch, facturaAsociada, page, soloRemitos, tipo]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** La exportación cubre solo comprobantes fiscales, con los mismos filtros aplicados. */
  const exportUrl = (format: "csv" | "xlsx") => {
    const query = new URLSearchParams({ format });
    if (applied.estado) query.set("estado", applied.estado);
    if (applied.ambiente) query.set("ambiente", applied.ambiente);
    if (tipo && !soloRemitos) query.set("documentoTipo", tipo);
    if (applied.desde) query.set("desde", applied.desde);
    if (applied.hasta) query.set("hasta", applied.hasta);
    if (deferredSearch) query.set("search", deferredSearch);
    return `/api/facturas/export?${query}`;
  };

  const cambiarTipo = (next: FacturaDocumentoTipoFilter) => {
    setPage(1);
    // El estado es solo fiscal; clase y factura asociada son solo de remitos.
    setApplied((current) => ({ ...current, documentoTipo: next, estado: next === "REMITO" ? "" : current.estado }));
    if (next !== "REMITO") {
      setClase("");
      setFacturaAsociada("");
    }
    router.replace(next ? `${ROUTES.facturacion}?tipo=${next}` : ROUTES.facturacion, { scroll: false });
  };

  const applyFilters = (filters: FacturasFilters) => {
    setPage(1);
    setApplied({ ...filters, documentoTipo: applied.documentoTipo });
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
        title="Documentos"
        subtitle="Facturas, notas de crédito y débito y remitos: consultá su estado y el detalle que quedó registrado."
      />

      <FacturasToolbar
        search={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onOpenFilters={() => setFiltersOpen(true)}
        documentoTipo={tipo}
        onDocumentoTipoChange={cambiarTipo}
        chips={filterChips}
        onRemoveChip={removeFilterChip}
        onClearFilters={() => {
          setApplied({ ...initialFilters, documentoTipo: applied.documentoTipo });
          setClase("");
          setFacturaAsociada("");
          setPage(1);
        }}
      >
        {soloRemitos ? (
          <div css={styles.subChips} aria-label="Filtros de remitos" data-testid="documentos-filtros-remitos">
            {([["R", "Remito R"], ["X", "Remito X"]] as const).map(([value, label]) => (
              <FilterChip
                key={value}
                text={label}
                selected={clase === value}
                onClick={() => { setClase(clase === value ? "" : value); setPage(1); }}
              />
            ))}
            {([["con", "Con factura"], ["sin", "Sin factura"]] as const).map(([value, label]) => (
              <FilterChip
                key={value}
                text={label}
                selected={facturaAsociada === value}
                onClick={() => { setFacturaAsociada(facturaAsociada === value ? "" : value); setPage(1); }}
              />
            ))}
          </div>
        ) : null}
      </FacturasToolbar>

      <div style={styles.toolbar}>
        <div>
          <span style={styles.count}>{result.total} documento{result.total === 1 ? "" : "s"}</span>
        </div>
        <div style={styles.actions}>
          {soloRemitos ? null : (
            <>
              <a href={exportUrl("csv")} style={styles.exportLink} title="Exporta los comprobantes fiscales con los filtros aplicados"><Download size={16} /> CSV</a>
              <a href={exportUrl("xlsx")} style={styles.exportLink} title="Exporta los comprobantes fiscales con los filtros aplicados"><FileSpreadsheet size={16} /> Excel</a>
            </>
          )}
          {hasPermission(Permission.FacturasEdit) ? (
            <Button
              text="Nuevo remito"
              icon={<Plus size={16} />}
              onClick={() => setCreateRemitoOpen(true)}
              style={styles.newButton}
              hideTextOnMobile={false}
              dataTestId="documentos-nuevo-remito"
            />
          ) : null}
        </div>
      </div>

      {error ? <div role="alert" style={styles.error}>{error}</div> : null}
      {loading ? <p role="status" style={{ color: COLOR.TEXT.SECONDARY, padding: "24px 0" }}>Cargando documentos…</p> : null}
      {!loading && !error && result.items.length === 0 ? (
        <Card style={styles.empty}>
          <ReceiptText size={34} color={COLOR.TEXT.TERTIARY} />
          <strong>No hay documentos para estos filtros</strong>
          <span>Cuando se emita una factura, una nota o un remito aparecerá acá con todo su historial.</span>
        </Card>
      ) : null}
      {!loading && result.items.length ? (
        <div style={styles.list}>
          {result.items.map((item) => (
            item.tipo === "FISCAL"
              ? <FacturaListItem key={`fiscal-${item.id}`} invoice={item.factura} />
              : <RemitoListItem key={`remito-${item.id}`} remito={item.remito} />
          ))}
        </div>
      ) : null}

      {!loading && result.total > result.pageSize ? (
        <nav style={styles.pagination} aria-label="Paginación de documentos">
          <Button text="Anterior" outline disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} hideTextOnMobile={false} />
          <span>Página {page} de {totalPages}</span>
          <Button text="Siguiente" outline disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} hideTextOnMobile={false} />
        </nav>
      ) : null}

      <FacturasFiltersModal
        open={filtersOpen}
        initial={applied}
        hideEstado={soloRemitos}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />
      <RemitoCreateModal
        open={createRemitoOpen}
        onClose={() => setCreateRemitoOpen(false)}
        onEmitted={(remitoId) => router.push(`${ROUTES.remitos}/${remitoId}`)}
      />
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" as const },
  count: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  actions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },
  exportLink: { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: COLOR.TEXT.PRIMARY, border: `1px solid ${COLOR.BORDER.SUBTLE}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, fontWeight: 600 },
  newButton: { height: 36, fontSize: 14 },
  subChips: css({ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }),
  list: { display: "flex", flexDirection: "column" as const, gap: 9 },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 20, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  empty: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, padding: 36, textAlign: "center" as const, color: COLOR.TEXT.SECONDARY },
  error: { color: COLOR.ICON.DANGER, background: COLOR.BACKGROUND.DANGER_TINT, padding: 12, borderRadius: 8, marginBottom: 12 },
} as const;
