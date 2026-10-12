"use client";

import { useState } from "react";
import { Package, Plus, ReceiptText, SquarePen, Trash2 } from "lucide-react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import NumberInput from "@/app/components/ui/NumberInput";
import ReadOnlyLineaCard from "@/app/components/arreglos/lineas/shared/ReadOnlyLineaCard";
import { styles as lineaStyles } from "@/app/components/arreglos/lineas/shared/lineaStyles";
import { formatArs } from "@/lib/format";
import {
  CONCEPTO_NUEVO,
  fromCents,
  newConcepto,
  removeConcepto,
  selectOrigen,
  setCantidad,
  setDescripcion,
  setImporte,
  sumCents,
  toCents,
  type ConceptoNota,
  type ConceptoNotaCatalogo,
} from "@/lib/facturacion/notaCreditoConceptos";
import { COLOR } from "@/theme/theme";

type Props = {
  /** La ND sólo admite conceptos nuevos y no mueve stock. */
  tipo: "NOTA_CREDITO" | "NOTA_DEBITO";
  catalog: ConceptoNotaCatalogo[];
  items: ConceptoNota[];
  onItemsChange: (items: ConceptoNota[]) => void;
  disabled?: boolean;
};

function money(cents: number) {
  return formatArs(fromCents(cents), { minDecimals: 2, maxDecimals: 2 });
}

export default function NotaConceptosSection({ tipo, catalog, items, onItemsChange, disabled = false }: Props) {
  const [adding, setAdding] = useState(false);
  const isDebit = tipo === "NOTA_DEBITO";
  const byOrdinal = new Map(catalog.map((line) => [line.ordinal, line]));
  const totalCents = sumCents(items);
  const unitsToReturn = items.reduce((sum, item) => sum + (item.tipo === "FACTURA" ? item.cantidad : 0), 0);

  const options: AutocompleteOption[] = [
    {
      value: CONCEPTO_NUEVO,
      label: "Concepto nuevo",
      secondaryLabel: "Propio de la nota, no se relaciona con la factura ni con el stock",
      icon: <SquarePen size={16} />,
    },
    ...catalog
      .filter((line) => !items.some((item) => item.ordinal === line.ordinal))
      .map((line) => ({
        value: String(line.ordinal),
        label: line.descripcion,
        secondaryLabel: `${line.codigo ? `${line.codigo} · ` : ""}Facturado ${money(line.topeCents)}`,
        icon: line.stockRestante !== null ? <Package size={16} /> : <ReceiptText size={16} />,
      })),
  ];

  const add = (value: string) => {
    if (!value) return;
    const key = crypto.randomUUID();
    onItemsChange(selectOrigen([...items, newConcepto(key)], key, value, catalog));
    setAdding(false);
  };

  const amountField = (item: ConceptoNota, label: string, max?: number) => (
    <label style={styles.field}>
      <span>Monto</span>
      <NumberInput
        aria-label={`Monto a ${isDebit ? "debitar" : "acreditar"}: ${label}`}
        minValue={0}
        max={max === undefined ? undefined : fromCents(max)}
        value={fromCents(item.importeCents)}
        onValueChange={(amount) => onItemsChange(setImporte(items, item.key, toCents(amount), catalog))}
        disabled={disabled}
        style={styles.amountInput}
      />
    </label>
  );

  const deleteButton = (item: ConceptoNota, label: string) => (
    <button
      type="button"
      style={styles.deleteButton}
      aria-label={`Quitar concepto: ${label}`}
      onClick={() => onItemsChange(removeConcepto(items, item.key))}
      disabled={disabled}
    >
      <Trash2 size={18} color={COLOR.ICON.DANGER} />
    </button>
  );

  return (
    <section aria-label={`Conceptos de la nota de ${isDebit ? "débito" : "crédito"}`} style={styles.section}>
      <h3 style={styles.title}>{isDebit ? "Conceptos a debitar" : "Conceptos a acreditar"}</h3>
      <p style={styles.muted}>
        {isDebit
          ? "Agregá los conceptos que se cobran con la nota. El importe de la nota es la suma de los conceptos."
          : "Agregá productos o conceptos de la factura original, o conceptos nuevos propios de la nota. El importe de la nota es la suma de los conceptos."}
      </p>

      <div style={lineaStyles.list}>
        {items.length === 0 && !adding ? <div style={lineaStyles.emptyState}>Todavía no agregaste conceptos.</div> : null}

        {items.map((item) => {
          if (item.tipo === "PROPIO") {
            const label = item.descripcion.trim() || "concepto nuevo";
            return (
              <ReadOnlyLineaCard
                key={item.key}
                kind="repuestos"
                icon={<SquarePen size={18} color={COLOR.ACCENT.PRIMARY} />}
                allowTitleWrap
                title={
                  <label style={styles.conceptField}>
                    <span>Concepto</span>
                    <input
                      aria-label="Descripción del concepto nuevo"
                      placeholder="Descripción del concepto"
                      required
                      maxLength={200}
                      value={item.descripcion}
                      onChange={(event) => onItemsChange(setDescripcion(items, item.key, event.target.value))}
                      disabled={disabled}
                      style={styles.titleInput}
                    />
                  </label>
                }
                // Vacío a propósito: sin esto la tarjeta muestra su "cantidad × unitario" por defecto.
                detailContent={<></>}
                sideContent={<div style={styles.side}>{amountField(item, label)}{deleteButton(item, label)}</div>}
                cantidad={1}
                unitario={0}
                onEdit={() => undefined}
                onDelete={() => undefined}
                canInteract={false}
                readOnly
              />
            );
          }

          const line = item.ordinal === null ? undefined : byOrdinal.get(item.ordinal);
          if (!line) return null;
          const movesStock = line.stockRestante !== null;
          return (
            <ReadOnlyLineaCard
              key={item.key}
              kind="repuestos"
              icon={movesStock ? undefined : <ReceiptText size={18} color={COLOR.ACCENT.PRIMARY} />}
              allowTitleWrap
              title={
                <div style={styles.lineTitle}>
                  <span>{line.descripcion}</span>
                  {line.codigo ? <span style={styles.code}>{line.codigo}</span> : null}
                </div>
              }
              detailContent={
                <span style={styles.stats}>
                  <span>Facturado <strong>{line.cantidadOriginal} × {money(line.unitarioCents)} = {money(line.topeCents)}</strong></span>
                  {movesStock ? <span>Disponible para devolver <strong>{line.stockRestante}</strong></span> : null}
                </span>
              }
              sideContent={
                <div style={styles.side}>
                  {movesStock ? (
                    <label style={styles.field}>
                      <span>A devolver</span>
                      <NumberInput
                        aria-label={`Cantidad a devolver: ${line.descripcion}`}
                        minValue={0}
                        max={line.stockRestante ?? 0}
                        allowDecimals={false}
                        value={item.cantidad}
                        onValueChange={(cantidad) => onItemsChange(setCantidad(items, item.key, cantidad, catalog))}
                        disabled={disabled}
                        style={styles.quantityInput}
                      />
                    </label>
                  ) : null}
                  {amountField(item, line.descripcion, line.topeCents)}
                  {deleteButton(item, line.descripcion)}
                </div>
              }
              cantidad={line.cantidadOriginal}
              unitario={0}
              onEdit={() => undefined}
              onDelete={() => undefined}
              canInteract={false}
              readOnly
            />
          );
        })}

        {adding ? (
          <div style={styles.addRow}>
            <Autocomplete
              options={options}
              value=""
              onChange={add}
              placeholder="Buscar producto de la factura o elegir concepto nuevo..."
              style={{ flex: 1 }}
            />
            <button type="button" style={styles.cancelButton} onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        ) : (
          <button
            type="button"
            style={lineaStyles.addRowBtn}
            onClick={() => isDebit ? add(CONCEPTO_NUEVO) : setAdding(true)}
            disabled={disabled}
          >
            <Plus size={18} />
            Agregar concepto
          </button>
        )}
      </div>

      {items.length ? (
        <div style={styles.summary}>
          {isDebit ? null : (
            <span>{unitsToReturn > 0 ? `${unitsToReturn} unidades volverían al stock al autorizarse la nota.` : "La nota no devuelve unidades al stock."}</span>
          )}
          <span style={styles.totalLabel}>Importe de la nota <strong style={styles.total}>{money(totalCents)}</strong></span>
        </div>
      ) : null}
    </section>
  );
}

const styles = {
  section: { display: "flex", flexDirection: "column" as const, gap: 10 },
  title: { margin: 0, fontSize: 18 },
  muted: { color: COLOR.TEXT.SECONDARY, margin: 0, fontSize: 13 },
  lineTitle: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const },
  code: { marginLeft: 4, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  conceptField: { display: "flex", flexDirection: "column" as const, gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  titleInput: { width: "100%", maxWidth: 420, height: 38, borderRadius: 8, border: `1px solid ${COLOR.BORDER.SUBTLE}`, padding: "0 10px", background: COLOR.INPUT.PRIMARY.BACKGROUND, color: COLOR.TEXT.PRIMARY, fontSize: 14 },
  stats: { display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
  side: { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" as const, justifyContent: "flex-end" },
  field: { display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 500 },
  quantityInput: { width: 86, height: 38, padding: "0 10px" },
  amountInput: { width: 130, height: 38, padding: "0 10px" },
  deleteButton: { height: 38, width: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer" },
  addRow: { display: "flex", alignItems: "center", gap: 10 },
  cancelButton: { border: "none", background: "transparent", color: COLOR.TEXT.SECONDARY, fontWeight: 600, cursor: "pointer" },
  summary: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" as const, color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  totalLabel: { marginLeft: "auto" },
  total: { color: COLOR.TEXT.PRIMARY, fontSize: 16, marginLeft: 6 },
} as const;
