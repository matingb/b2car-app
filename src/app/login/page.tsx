"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routing/routes";
import { useSession } from "@/app/(user)/providers/SessionProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const { signIn } = useSession();

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await signIn(email, password);
      router.push(ROUTES.root);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Login</h1>
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
          <span style={styles.labelText}>Password</span>
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
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}
const styles = {
  container: {
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "28rem",
    padding: "1.5rem",
  },
  title: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 700,
    marginBottom: "1rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    rowGap: "1rem",
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
    background: "#000",
    color: "#fff",
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



