"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { Star } from "lucide-react";

type Props = {
  favorita?: boolean;
  onFavorite?: () => void;
  dataTestId?: string;
};

export default function CuentaFavoritaButton({
  favorita = false,
  onFavorite,
  dataTestId = "cuenta-favorita-button",
}: Props) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      onClick={(e) => {
        e.stopPropagation();
        if (!favorita) onFavorite?.();
      }}
      aria-disabled={favorita}
      css={[styles.button, favorita ? styles.buttonFavorita : styles.buttonNoFavorita]}
      title={favorita ? "Cuenta favorita" : "Marcar como favorita"}
      aria-label={favorita ? "Cuenta favorita" : "Marcar como favorita"}
      aria-pressed={favorita}
    >
      <Star size={17} fill={favorita ? "currentColor" : "none"} />
    </button>
  );
}

const styles = {
  button: css({
    width: 30,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.TERTIARY,
  }),
  buttonNoFavorita: css({
    cursor: "pointer",
    transition: "color 150ms ease, background-color 150ms ease, border-color 150ms ease",
    "&:hover": {
      color: COLOR.SEMANTIC.WARNING,
      background: COLOR.BACKGROUND.WARNING_TINT,
      borderColor: COLOR.SEMANTIC.WARNING,
    },
  }),
  buttonFavorita: css({
    color: COLOR.SEMANTIC.WARNING,
    background: COLOR.BACKGROUND.WARNING_TINT,
    borderColor: COLOR.SEMANTIC.WARNING,
    cursor: "default",
  }),
} as const;
