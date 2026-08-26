"use client";

import React from "react";
import { css } from "@emotion/react";
import { Pencil, Trash } from "lucide-react";
import IconButton from "@/app/components/ui/IconButton";
import { COLOR } from "@/theme/theme";

type Props = {
  isGasto: boolean;
  deleteTitle: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function OperacionActions({
  isGasto,
  deleteTitle,
  onEdit,
  onDelete,
}: Props) {
  if (!onEdit && !onDelete) return null;

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
