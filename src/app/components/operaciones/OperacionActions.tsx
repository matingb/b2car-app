"use client";

import React from "react";
import { css } from "@emotion/react";
import { FileBox, Pencil, ReceiptText, Trash } from "lucide-react";
import IconButton from "@/app/components/ui/IconButton";
import { COLOR } from "@/theme/theme";

type Props = {
  isGasto: boolean;
  deleteTitle: string;
  onEdit?: () => void;
  onInvoice?: () => void;
  onRemito?: () => void;
  onDelete?: () => void;
};

export default function OperacionActions({
  isGasto,
  deleteTitle,
  onEdit,
  onInvoice,
  onRemito,
  onDelete,
}: Props) {
  if (!onEdit && !onInvoice && !onRemito && !onDelete) return null;

  return (
    <div css={styles.metaActions}>
      {isGasto && onEdit ? (
        <IconButton
          icon={<Pencil />}
          title="Editar gasto"
          ariaLabel="Editar gasto"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        />
      ) : null}
      {onInvoice ? (
        <IconButton
          icon={<ReceiptText />}
          title="Facturar electrónicamente"
          ariaLabel="Facturar electrónicamente"
          hoverColor={COLOR.ACCENT.PRIMARY}
          onClick={(e) => {
            e.stopPropagation();
            onInvoice();
          }}
        />
      ) : null}
      {onRemito ? (
        <IconButton
          icon={<FileBox />}
          title="Generar remito"
          ariaLabel="Generar remito"
          hoverColor={COLOR.ACCENT.PRIMARY}
          onClick={(e) => {
            e.stopPropagation();
            onRemito();
          }}
        />
      ) : null}
      {onDelete ? (
        <IconButton
          icon={<Trash />}
          title={deleteTitle}
          ariaLabel={deleteTitle}
          hoverColor={COLOR.SEMANTIC.DANGER}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
      ) : null}
    </div>
  );
}

const styles = {
  metaActions: css({
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  }),
};
