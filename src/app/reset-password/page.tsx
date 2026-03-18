"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { css } from "@emotion/react";
import PasswordRequirements, {
  getPasswordValidationError,
  MIN_PASSWORD_LENGTH,
} from "@/app/components/auth/PasswordRequirements";
import { useToast } from "@/app/providers/ToastProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import pkg from "../../../package.json";
import Button from "../components/ui/Button";
import { resetPassword } from "./actions";

const APP_VERSION = pkg.version;

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const token = searchParams.get("access_token");
  const passwordValidationError = getPasswordValidationError(
    password,
    confirmPassword,
  );
  const isSubmitDisabled = isSubmitting || !!passwordValidationError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validationError = getPasswordValidationError(
      password,
      confirmPassword,
    );

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPassword({ token: token ?? "", password });

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      toast.success(
        "Contraseña actualizada",
        "Ya podes iniciar sesión con tu nueva contraseña.",
      );
      router.push("/");
    } catch {
      setFormError("No se pudo actualizar la contraseña. Intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.splitContainer}>
      <div css={styles.leftPanel} />

      <div css={styles.rightPanel}>
        <div style={styles.rightInner}>
          <Image
            src="/logos/logoGrande.svg"
            alt="B2Car"
            width={725}
            height={591}
            style={styles.brandLogo}
            priority
          />

          <div style={styles.header}>
            <h1 css={styles.title}>Restablecer contraseña</h1>
            <p style={styles.subtitle}>
              Ingresá tu nueva contraseña para completar el cambio.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.labelBlock}>
              <span style={styles.labelText}>Nueva contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={styles.input}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </label>

            <label style={styles.labelBlock}>
              <span style={styles.labelText}>Confirmar contraseña</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={styles.input}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </label>

            <div style={styles.requirementsCard}>
              <PasswordRequirements
                password={password}
                confirmPassword={confirmPassword}
              />
            </div>

            {formError ? (
              <div style={styles.fieldErrorContainer}>
                <div
                  style={styles.fieldError}
                  role="alert"
                  data-testid="reset-password-error"
                >
                  {formError}
                </div>
              </div>
            ) : null}

            <Button
              text={isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
              disabled={isSubmitDisabled}
              type="submit"
              style={{ width: "100%", height: "45px" }}
            />
          </form>

          <div style={styles.versionLabel}>v{APP_VERSION}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  splitContainer: {
    display: "flex",
    minHeight: "100dvh",
    width: "100%",
  },
  leftPanel: css({
    flex: 1,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLOR.ACCENT.PRIMARY,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      display: "none",
    },
  }),
  rightPanel: css({
    width: "45%",
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: COLOR.BACKGROUND.SECONDARY,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "100%",
      padding: "0.5rem",
    },
  }),
  rightInner: {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  brandLogo: {
    display: "block",
    width: "100%",
    maxWidth: 225,
    height: "auto",
    marginBottom: "32px",
  },
  header: {
    width: "90%",
    marginBottom: "1.25rem",
  },
  title: css({
    margin: 0,
    color: COLOR.TEXT.PRIMARY,
    fontSize: "1.75rem",
    lineHeight: "2.25rem",
    fontWeight: 700,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      fontSize: "1.3rem",
      lineHeight: "1.75rem",
    },
  }),
  subtitle: {
    marginTop: "0.5rem",
    marginBottom: 0,
    color: COLOR.TEXT.SECONDARY,
    fontSize: "0.95rem",
    lineHeight: "1.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
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
    color: COLOR.TEXT.PRIMARY,
  },
  input: {
    marginTop: "0.25rem",
    width: "100%",
    borderRadius: "0.375rem",
    border: `1px solid ${COLOR.INPUT.PRIMARY.BORDER}`,
    padding: "0.75rem",
    color: COLOR.INPUT.PRIMARY.TEXT,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  requirementsCard: {
    borderRadius: "0.75rem",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    padding: "0.875rem 1rem",
  },
  fieldErrorContainer: {
    background: COLOR.BACKGROUND.DANGER_TINT,
    borderRadius: 8,
    padding: "12px 14px",
    color: COLOR.ICON.DANGER,
  },
  fieldError: {
    whiteSpace: "pre-line",
    marginTop: "-0.25rem",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    color: COLOR.SEMANTIC.DANGER,
  },
  versionLabel: {
    position: "absolute" as const,
    right: 16,
    bottom: -36,
    fontSize: 12,
    lineHeight: "16px",
    color: COLOR.TEXT.TERTIARY,
    userSelect: "none" as const,
  },
} as const;
