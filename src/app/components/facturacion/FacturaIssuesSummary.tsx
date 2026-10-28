"use client";

import { forwardRef, useId } from "react";
import { CircleAlert, Info } from "lucide-react";
import { COLOR } from "@/theme/theme";
import {
  FACTURA_ISSUE_GRUPO_LABEL,
  type FacturaIssue,
  type FacturaIssueGrupo,
} from "@/lib/facturacion/types";

type Props = {
  issues: FacturaIssue[];
  /** Lleva el foco al input del mensaje elegido. */
  onSelectCampo: (campo: string) => void;
};

const GRUPOS = Object.keys(FACTURA_ISSUE_GRUPO_LABEL) as FacturaIssueGrupo[];

export function facturaIssueId(issue: FacturaIssue): string {
  return `factura-issue-${issue.codigo}-${issue.campo ?? "general"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/** Mismo texto y campo: el servidor y el formulario pueden informar el mismo problema. */
export function uniqueFacturaIssues(issues: FacturaIssue[]): FacturaIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severidad}|${issue.campo ?? ""}|${issue.mensaje}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Bloqueos agrupados con acceso a su campo; los avisos no bloqueantes van aparte. */
const FacturaIssuesSummary = forwardRef<HTMLDivElement, Props>(function FacturaIssuesSummary({ issues, onSelectCampo }, ref) {
  const titleId = useId();
  const errors = issues.filter((issue) => issue.severidad === "error");
  const warnings = issues.filter((issue) => issue.severidad === "advertencia");
  if (!issues.length) return null;

  return (
    <div ref={ref} tabIndex={-1} role="group" aria-labelledby={titleId} style={styles.container} data-testid="factura-issues">
      {errors.length ? (
        <div style={styles.errors}>
          <strong id={titleId} style={styles.title} aria-live="polite">
            <CircleAlert size={16} aria-hidden="true" />
            Revisá estos datos ({errors.length})
          </strong>
          {GRUPOS.map((grupo) => {
            const items = errors.filter((issue) => issue.grupo === grupo);
            if (!items.length) return null;
            return (
              <div key={grupo} style={styles.group}>
                <span style={styles.groupLabel}>{FACTURA_ISSUE_GRUPO_LABEL[grupo]}</span>
                <ul style={styles.list}>
                  {items.map((issue) => (
                    <li key={facturaIssueId(issue)} id={facturaIssueId(issue)}>
                      {issue.campo ? (
                        <button type="button" style={styles.issueLink} onClick={() => onSelectCampo(issue.campo!)}>
                          {issue.mensaje}
                        </button>
                      ) : issue.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
      {warnings.length ? (
        <div style={styles.warnings}>
          <strong id={errors.length ? undefined : titleId} style={styles.warningTitle}>
            <Info size={16} aria-hidden="true" />
            Avisos
          </strong>
          <ul style={styles.list}>
            {warnings.map((issue) => <li key={facturaIssueId(issue)}>{issue.mensaje}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
});

export default FacturaIssuesSummary;

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 10, outline: "none" },
  errors: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLOR.SEMANTIC.DANGER}`,
    background: COLOR.BACKGROUND.DANGER_TINT,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
  },
  title: { display: "flex", alignItems: "center", gap: 8, color: COLOR.ICON.DANGER, fontSize: 14 },
  group: { display: "flex", flexDirection: "column" as const, gap: 4 },
  groupLabel: { color: COLOR.TEXT.SECONDARY, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  list: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column" as const, gap: 4, lineHeight: 1.4 },
  issueLink: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    font: "inherit",
    textAlign: "left" as const,
    textDecoration: "underline",
  },
  warnings: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLOR.SEMANTIC.ALERT}`,
    background: COLOR.BACKGROUND.ALERT_TINT,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
  },
  warningTitle: { display: "flex", alignItems: "center", gap: 8, color: COLOR.SEMANTIC.WARNING, fontSize: 14 },
} as const;
