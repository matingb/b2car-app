"use client";

import React from "react";
import { css } from "@emotion/react";
import { DollarSign } from "lucide-react";
import { safeInt, safeNumber } from "@/lib/numbers";
import { formatMoney } from "./lineaUtils";
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
  top: React.ReactNode;
  draft: NewProductLineaDraft;
  onDraftChange: (patch: Partial<NewProductLineaDraft>) => void;
  extra?: React.ReactNode;
};

export default function NewProductLineaCard({
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
      <div>{top}</div>

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

      <div css={footer}>
        <div style={lineaStyles.editorTotalText}>{totalText}</div>
        <LineaEditorActions variant="footer" />
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
    gap: 10,
  }),
  fieldsRow: css({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  }),
} as const;
