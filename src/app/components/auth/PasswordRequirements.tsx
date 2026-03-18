"use client";

import { COLOR } from "@/theme/theme";

type PasswordRequirementsProps = {
  password: string;
  confirmPassword: string;
};

export const MIN_PASSWORD_LENGTH = 8;

function hasMinLength(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

function hasNumber(password: string) {
  return /\d/.test(password);
}

function hasLowercase(password: string) {
  return /[a-z]/.test(password);
}

function hasUppercase(password: string) {
  return /[A-Z]/.test(password);
}

function hasSpecialCharacter(password: string) {
  return /[^A-Za-z0-9]/.test(password);
}

function passwordsMatch(password: string, confirmPassword: string) {
  return confirmPassword.length > 0 && password === confirmPassword;
}

export function getPasswordValidationError(
  password: string,
  confirmPassword: string
): string | null {
  if (!hasMinLength(password)) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }

  if (!hasNumber(password)) {
    return "La contraseña debe incluir al menos un numero.";
  }

  if (!hasLowercase(password)) {
    return "La contraseña debe incluir al menos una minuscula.";
  }

  if (!hasUppercase(password)) {
    return "La contraseña debe incluir al menos una mayuscula.";
  }

  if (!hasSpecialCharacter(password)) {
    return "La contraseña debe incluir al menos un caracter especial.";
  }

  if (password !== confirmPassword) {
    return "Las contraseñas no coinciden.";
  }

  return null;
}

export default function PasswordRequirements({
  password,
  confirmPassword,
}: PasswordRequirementsProps) {
  const items = [
    {
      id: "min-length",
      label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      isMet: hasMinLength(password),
    },
    {
      id: "has-number",
      label: "Al menos un numero",
      isMet: hasNumber(password),
    },
    {
      id: "has-lowercase",
      label: "Al menos una minuscula",
      isMet: hasLowercase(password),
    },
    {
      id: "has-uppercase",
      label: "Al menos una mayuscula",
      isMet: hasUppercase(password),
    },
    {
      id: "has-special-character",
      label: "Al menos un caracter especial",
      isMet: hasSpecialCharacter(password),
    },
    {
      id: "matches",
      label: "Las contraseñas coinciden",
      isMet: passwordsMatch(password, confirmPassword),
    },
  ];

  return (
    <ul style={styles.list} aria-label="Requisitos de contraseña">
      {items.map((item) => (
        <li
          key={item.id}
          style={{
            ...styles.item,
            color: item.isMet ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.TERTIARY,
          }}
          data-testid={`password-requirement-${item.id}`}
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            style={{
              ...styles.bullet,
              backgroundColor: item.isMet
                ? COLOR.ACCENT.PRIMARY
                : COLOR.BORDER.WEAK,
            }}
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

const styles = {
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    transition: "color 0.2s ease",
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
    transition: "background-color 0.2s ease",
  },
} as const;
