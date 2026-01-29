import React, { useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  text: string;
  onClick?: () => void;
  hideText?: boolean;
  outline?: boolean;
  dataTestId?: string;
};

export default function Button({
  icon = null,
  style,
  text,
  hideText = true,
  outline = false,
  onClick,
  dataTestId,
  ...rest
}: ButtonProps) {

  const [hover, setHover] = useState(false);

  const isDisabled = rest.disabled;
  const hoverStyles = outline ? styles.buttonOutlineHover : styles.buttonHover;
  const disabledStyles = outline ? styles.buttonOutlineDisabled : styles.buttonDisabled;

  return (
    <button
      style={{
        //...styles.button,
        ...(hover && !isDisabled && hoverStyles),
        ...(isDisabled && disabledStyles),
        ...style
      }}
      {...rest}
      onMouseEnter={() => !isDisabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      css={[styles.button, outline && styles.buttonOutline]}
      data-testid={dataTestId}
      aria-label={text}
    >
      {icon && icon}
      <p css={hideText ? styles.text : undefined}>{text}</p>
    </button>
  );
}

const styles = {
  button: css({
    background: COLOR.ACCENT.PRIMARY,
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
    transition: "background 0.2s",
    border: "none",
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      minWidth: 0,
    },
  }),
  buttonHover: {
    background: `${COLOR.ACCENT.HOVER}`,
  },
  buttonOutline: css({
    background: `${COLOR.BACKGROUND.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  buttonOutlineHover: {
    background: `${COLOR.BACKGROUND.PRIMARY}`,
    color: COLOR.TEXT.PRIMARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
  buttonOutlineDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
  text: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: 'none',
    },
  })
} as const;
