"use client";

import React from "react";
import { css } from "@emotion/react";
import { DollarSign, Package, Wrench } from "lucide-react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatMoney } from "./lineaUtils";
import { itemIconCircleStyle, innerFillStyle, styles as lineaStyles } from "./lineaStyles";
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

  return (
    <Card css={styles.card}>
      <div css={styles.row}>
        <div css={styles.leadingIcon(kind)}>
          {kind === "servicios" ? (
            <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
          ) : (
            <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
          )}
        </div>

        <div css={styles.body}>
          <div css={styles.topWrap}>{top}</div>

          <div css={styles.qtyUnitRow}>
            <input
              css={qtyInput}
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
                  wrapperStyle={innerFillStyle}
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
                wrapperStyle={innerFillStyle}
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.unit}
                onChange={(e) => onDraftChange({ unit: e.target.value.replace(/\D/g, "") })}
                placeholder={showPurchaseUnit ? "Venta" : "0.00"}
                disabled={!interactionEnabled}
                aria-label="Precio venta"
              />
            </div>
          </div>

          <div css={footer}>
            <div style={lineaStyles.editorTotalText}>{totalText}</div>
            <LineaEditorActions variant="footer" />
          </div>
        </div>
      </div>

      {extra}
    </Card>
  );
}

const qtyInput = css({ ...lineaStyles.editorInput, ...lineaStyles.editorQtyInput });
const fieldUnit = css(lineaStyles.editorFieldUnit);
const footer = css(lineaStyles.editorFooter);

const styles = {
  card: css({
    display: "flex",
    flexDirection: "column",
    gap: 14,
  }),
  row: css({
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      flexWrap: "nowrap",
    },
  }),
  leadingIcon: (kind: Kind) =>
    css({
      ...itemIconCircleStyle(kind),
      ...lineaStyles.hideItemIconOnSm,
    }),
  body: css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
    },
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
  }),
  topWrap: css({
    minWidth: 0,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: { flex: 1 },
  }),
  qtyUnitRow: css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.xl}px)`]: {
      width: "auto",
      flex: "0 1 360px",
      flexWrap: "nowrap",
    },
  }),
} as const;
