"use client";

import { useState } from "react";
import { login } from "./actions";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await login(email, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.splitContainer}>
      <div css={styles.leftPane}>
        {/* Imagen ilustrativa - reemplazá el path por el tuyo */}
        <div style={styles.hero} />
        
      </div>

      <div css={styles.rightPane}>
        <div style={styles.rightInner}>
          <img
            src="/logos/logoGrande.svg"
            alt="B2Car"
            style={styles.brandLogo}
          />
          <form onSubmit={handlePasswordSignIn} style={styles.form}>
            <label style={styles.labelBlock}>
              <span style={styles.labelText}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.labelBlock}>
              <span style={styles.labelText}>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...styles.button, ...(isSubmitting ? styles.buttonDisabled : undefined) }}
            >
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>
          <div style={styles.versionLabel}>v1.1.0</div>
          {message && <p style={styles.message}>{message}</p>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  splitContainer: {
    display: 'flex',
    minHeight: '100dvh',
    width: '100%',
  },
  leftPane: css({
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLOR.ACCENT.PRIMARY,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: 'none',
    },
  }),
  versionLabel: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    fontSize: 12,
    lineHeight: '16px',
    color: COLOR.TEXT.TERTIARY,
    userSelect: 'none',
  },
  hero: {
    // Replace this backgroundImage path with your illustration
    width: '80%',
    height: '80%',
    backgroundImage: "url('/path/to/illustration.png')",
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    borderRadius: 12,
  },
  rightPane: css({
    width: "45%",
    maxWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: COLOR.BACKGROUND.SECONDARY,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: '100%',
    },
  }),
  rightInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420
  },
  brand: {
    fontSize: 48,
    fontWeight: 800,
    marginBottom: '1rem',
  },
  brandLogo: {
    display: "block",
    width: "100%",
    maxWidth: 260,
    height: "auto",
    marginBottom: "48px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    rowGap: "1rem",
    width: "90%",
  },
  labelBlock: {
    display: "block",
  },
  labelText: {
    display: "block",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    fontWeight: 500,
  },
  input: {
    marginTop: "0.25rem",
    width: "100%",
    borderRadius: "0.375rem",
    border: "1px solid rgba(0,0,0,0.15)",
    padding: "0.5rem 0.75rem",
    color: "#000",
    background: "#fff",
  },
  button: {
    borderRadius: "0.375rem",
    background: COLOR.BUTTON.PRIMARY.BACKGROUND,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    padding: "0.5rem 1rem",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  message: {
    marginTop: "1rem",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
  },
} as const;



