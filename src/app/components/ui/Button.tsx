import React, { useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  text: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
};

export default function Button({
  icon = null,
  style,
  text,
  onClick,
  ...rest
}: ButtonProps) {

  const [hover, setHover] = useState(false);

  const isDisabled = rest.disabled;

  return (
    <button
      style={{
        //...styles.button,
        ...(hover && !isDisabled && styles.buttonHover),
        ...(isDisabled && styles.buttonDisabled),
        ...style
      }}
      {...rest}
      onMouseEnter={() => !isDisabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      css={styles.button}
    >
      {icon && icon}
      <p css={styles.text}>{text}</p>
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
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      minWidth: 0,
    },
  }),
  buttonHover: {
    background: `${COLOR.ACCENT.HOVER}`,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
  text: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: 'none',
    },
  })
} as const;
