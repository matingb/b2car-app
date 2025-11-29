import React, { useState } from "react";
import { COLOR } from "@/theme/theme";

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
        ...styles.button, 
        ...(hover && !isDisabled && styles.buttonHover),
        ...(isDisabled && styles.buttonDisabled),
        ...style 
      }}
      {...rest}
      onMouseEnter={() => !isDisabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {icon && icon }
      <p>{text}</p>
    </button>
  );
}

const styles = {
  button: {
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    fontSize: "16px",
    borderRadius: 8,
    display: "flex",
    padding: "0.5rem 1rem",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
  buttonHover: {
    background: `${COLOR.ACCENT.PRIMARY}90`,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
} as const;
