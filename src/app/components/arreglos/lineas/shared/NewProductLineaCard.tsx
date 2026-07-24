"use client";

import React from "react";
import { css } from "@emotion/react";
import { DollarSign } from "lucide-react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { formatMoney } from "./lineaUtils";
import { BREAKPOINTS } from "@/theme/theme";
import { innerFillStyle, styles as lineaStyles } from "./lineaStyles";
import { useInlineEditorContext } from "./InlineEditorContext";
import Card from "../../../ui/Card";
import IconInput from "../../../ui/IconInput";
import LineaEditorActions from "./LineaEditorActions";

export type NewProductLineaDraft = {
  qty: string;
  purchaseUnit: string;
  saleUnit: string;
};

type Props = {
  header?: React.ReactNode;
  top: React.ReactNode;
  draft: NewProductLineaDraft;
  onDraftChange: (patch: Partial<NewProductLineaDraft>) => void;
  extra?: React.ReactNode;
};

export default function NewProductLineaCard({
  header,
  top,
  draft,
  onDraftChange,
  extra,
}: Props) {
  const { interactionEnabled } = useInlineEditorContext();

  const qty = safeInt(draft.qty);
  const saleUnit = safeNumber(draft.saleUnit);
  const totalText = formatMoney(qty * saleUnit);

  return (
    <Card css={styles.card}>
      {header ? <div css={styles.header}>{header}</div> : null}

      <div css={styles.productFields}>{top}</div>

      <div css={styles.pricingRow}>
        <div css={styles.fieldsRow}>
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
          <div css={fieldUnit}>
            <IconInput
              icon={<DollarSign size={14} />}
              wrapperStyle={innerFillStyle}
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.purchaseUnit}
              onChange={(e) => onDraftChange({ purchaseUnit: e.target.value.replace(/\D/g, "") })}
              placeholder="Compra"
              disabled={!interactionEnabled}
              aria-label="Precio compra"
            />
          </div>
          <div css={fieldUnit}>
            <IconInput
              icon={<DollarSign size={14} />}
              wrapperStyle={innerFillStyle}
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.saleUnit}
              onChange={(e) => onDraftChange({ saleUnit: e.target.value.replace(/\D/g, "") })}
              placeholder="Venta"
              disabled={!interactionEnabled}
              aria-label="Precio venta"
            />
          </div>
        </div>

        <div css={styles.footer}>
          <div style={lineaStyles.editorTotalText}>{totalText}</div>
          <LineaEditorActions variant="footer" />
        </div>
      </div>

      {extra}
    </Card>
  );
}

const qtyInput = css({ ...lineaStyles.editorInput, ...lineaStyles.editorQtyInput });
const fieldUnit = css(lineaStyles.editorFieldUnit);

const styles = {
  card: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  }),
  productFields: css({
    width: "100%",
  }),
  pricingRow: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  }),
  fieldsRow: css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    flex: 1,
    minWidth: 0,
  }),
  footer: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderTop: lineaStyles.editorFooter.borderTop,
    paddingTop: 12,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      justifyContent: "flex-end",
      borderTop: "none",
      paddingTop: 0,
      marginLeft: "auto",
      flexShrink: 0,
    },
  }),
} as const;
