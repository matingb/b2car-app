"use client";

import React from "react";
import { css } from "@emotion/react";
import { DollarSign, Package, Wrench } from "lucide-react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatMoney } from "./lineaUtils";
import { itemIconCircleStyle, styles as lineaStyles } from "./lineaStyles";
import { useInlineEditorContext } from "./InlineEditorContext";
import Card from "../../../ui/Card";
import IconInput from "../../../ui/IconInput";
import LineaEditorActions from "./LineaEditorActions";

type Kind = "servicios" | "repuestos";

export type EditableLineaDraft = {
  qty: string;
  unit: string;
  purchaseUnit?: string;
};

type Props = {
  top: React.ReactNode;
  draft: EditableLineaDraft;
  onDraftChange: (patch: Partial<EditableLineaDraft>) => void;
  showPurchaseUnit?: boolean;
  extra?: React.ReactNode;
};

export default function EditableLineaCard({
  top,
  draft,
  onDraftChange,
  showPurchaseUnit = false,
  extra,
}: Props) {
  const { kind, interactionEnabled } = useInlineEditorContext();

  const qty = safeInt(draft.qty);
  const unit = safeNumber(draft.unit);
  const totalText = formatMoney(qty * unit);

  // When the purchase price column is shown the layout uses a denser inline
  // footer (no leading icon, no total text alongside the actions).
  const compactLayout = showPurchaseUnit;

  return (
    <Card css={styles.card}>
      {compactLayout ? null : (
        <div css={styles.leadingIcon(kind)}>
          {kind === "servicios" ? (
            <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
          ) : (
            <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
          )}
        </div>
      )}

      <div css={styles.body(compactLayout)}>
        <div css={styles.topWrap(compactLayout)}>{top}</div>

        <div css={styles.qtyUnitRow(compactLayout)}>
          <input
            css={styles.qtyInput}
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.qty}
            onChange={(e) => onDraftChange({ qty: e.target.value.replace(/\D/g, "") })}
            placeholder="1"
            disabled={!interactionEnabled}
            aria-label="Cantidad"
          />
          {showPurchaseUnit ? (
            <div css={fieldUnit}>
              <IconInput
                icon={<DollarSign size={14} />}
                wrapperStyle={innerFill}
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.purchaseUnit ?? ""}
                onChange={(e) => onDraftChange({ purchaseUnit: e.target.value.replace(/\D/g, "") })}
                placeholder="Compra"
                disabled={!interactionEnabled}
                aria-label="Precio compra"
              />
            </div>
          ) : null}
          <div css={fieldUnit}>
            <IconInput
              icon={<DollarSign size={14} />}
              wrapperStyle={innerFill}
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.unit}
              onChange={(e) => onDraftChange({ unit: e.target.value.replace(/\D/g, "") })}
              placeholder={showPurchaseUnit ? "Venta" : "0.00"}
              disabled={!interactionEnabled}
              aria-label="Precio venta"
            />
          </div>
          {compactLayout ? <LineaEditorActions variant="inline" /> : null}
        </div>

        {compactLayout ? null : (
          <div css={styles.footer}>
            <div style={styles.totalText}>{totalText}</div>
            <LineaEditorActions variant="footer" />
          </div>
        )}
      </div>

      {extra ? <div css={styles.extra}>{extra}</div> : null}
    </Card>
  );
}

const fieldUnit = css({
  flex: "1 1 0",
  minWidth: 0,
  [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
    maxWidth: 200,
  },
});

const innerFill: React.CSSProperties = { width: "100%" };

const styles = {
  card: css({
    ...lineaStyles.itemCard,
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      flexWrap: "nowrap",
    },
  }),
  leadingIcon: (kind: Kind) =>
    css({
      ...itemIconCircleStyle(kind),
      ...lineaStyles.hideItemIconOnSm,
    }),
  body: (stackVertical: boolean) => css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
    },
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: stackVertical
      ? { gap: 10 }
      : {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
  }),
  topWrap: (stackVertical: boolean) => css({
    minWidth: 0,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: stackVertical ? {} : { flex: 1 },
  }),
  qtyUnitRow: (stackVertical: boolean) => css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: stackVertical
      ? {}
      : {
          width: "auto",
          flex: "0 1 360px",
          flexWrap: "nowrap",
        },
  }),
  qtyInput: css({
    ...lineaStyles.editorInput,
    paddingLeft: 8,
    paddingRight: 8,
    width: "65px",
    textAlign: "center" as const,
  }),
  footer: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      alignItems: "center",
      gap: 8,
    },
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      width: "auto",
      flexShrink: 0,
    },
  }),
  totalText: {
    fontWeight: 700,
    fontSize: 16,
    whiteSpace: "nowrap",
    minWidth: 70,
  },
  extra: css({
    width: "100%",
    flexBasis: "100%",
  }),
} as const;
