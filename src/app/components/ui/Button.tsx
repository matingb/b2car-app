import React from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  text: string;
  onClick?: () => void;
  hideTextOnMobile?: boolean;
  outline?: boolean;
  dataTestId?: string;
  ariaLabel?: string;
};

export default function Button({
  icon = null,
  style,
  text,
  hideTextOnMobile = true,
  outline = false,
  onClick,
  dataTestId,
  ariaLabel,
  ...rest
}: ButtonProps) {
  return (
    <button
      style={style}
      {...rest}
      onClick={onClick}
      css={[styles.button, outline && styles.buttonOutline]}
      data-testid={dataTestId}
      aria-label={ariaLabel ?? text}
    >
      {icon && icon}
      <p css={hideTextOnMobile ? styles.hideTextOnMobile : undefined}>{text}</p>
    </button>
  );
}

const styles = {
  button: css({
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    fontSize: "16px",
    borderRadius: 8,
    display: "flex",
    padding: "8px 12px",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    width: "fit-content",
    minWidth: 160,
    transition: "background-color 0.2s, opacity 0.2s",
    border: "none",
    "&:hover:not(:disabled)": {
      backgroundColor: COLOR.ACCENT.HOVER,
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "default",
    },
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      minWidth: 0,
    },
  }),
  buttonOutline: css({
    backgroundColor: `${COLOR.BACKGROUND.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    "&:hover:not(:disabled)": {
      backgroundColor: `${COLOR.BACKGROUND.PRIMARY}`,
      color: COLOR.TEXT.PRIMARY,
      border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "default",
    },
  }),
  hideTextOnMobile: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: 'none',
    },
  }),
};
