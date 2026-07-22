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
          <div css={styles.bodyTop}>
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
          </div>
          
          <div css={styles.bodyBottom}>
            {extra}
          </div>
        </div>

        <div css={footer}>
          <div css={styles.totalText}>{totalText}</div>
          <div css={styles.actionsWrap}>
             <LineaEditorActions variant="footer" />
          </div>
        </div>
      </div>
    </Card>
  );
}

const qtyInput = css({ ...lineaStyles.editorInput, ...lineaStyles.editorQtyInput });
const fieldUnit = css(lineaStyles.editorFieldUnit);
const footer = css(lineaStyles.editorFooter);

const styles = {
  card: css({
    padding: 16,
    border: `2px solid ${COLOR.ACCENT.PRIMARY}`, // highlight ring
    backgroundColor: "#ffffff",
  }),
  row: css({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
  }),
  leadingIcon: (kind: Kind) =>
    css({
      ...itemIconCircleStyle(kind),
      ...lineaStyles.hideItemIconOnSm,
      marginTop: 4,
    }),
  body: css({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  }),
  bodyTop: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
  }),
  bodyBottom: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  topWrap: css({
    minWidth: 0,
    width: "100%",
    flex: 1,
  }),
  qtyUnitRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  }),
  totalText: css({
    fontWeight: 700,
    fontSize: 18,
    color: COLOR.TEXT.PRIMARY,
    textAlign: "right",
    marginBottom: 8,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      textAlign: "right",
    },
  }),
  actionsWrap: css({
    display: "flex",
    justifyContent: "flex-end",
    width: "100%",
  }),
} as const;
