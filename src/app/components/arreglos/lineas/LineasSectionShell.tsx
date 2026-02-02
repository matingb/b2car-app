 "use client";

import React, { useMemo, useState } from "react";
import { COLOR } from "@/theme/theme";
import IconLabel from "@/app/components/ui/IconLabel";
import { ChevronDown } from "lucide-react";

type Props = {
  title: React.ReactNode;
  titleIcon: React.ReactNode;
  subtotal: React.ReactNode;
  children: React.ReactNode;
  collapseDisabled?: boolean;
};

export default function LineasSectionShell({
  title,
  titleIcon,
  subtotal,
  children,
  collapseDisabled = false,
}: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const ariaLabel = useMemo(
    () => (collapsed ? "Expandir sección" : "Colapsar sección"),
    [collapsed]
  );

  return (
    <div style={{overflow: 'clip'}}>
      <div style={styles.sectionTitle}>
        <IconLabel icon={titleIcon} label={title} />

        <div style={styles.sectionRight}>
          <div style={styles.subtotalInline}>
            <span style={styles.subtotalLabel}>Subtotal</span>
            <span style={styles.subtotalValue}>{subtotal}</span>
          </div>

          <button
            type="button"
            style={styles.toggleBtn}
            onClick={() => setCollapsed((v) => !v)}
            disabled={collapseDisabled}
            aria-label={ariaLabel}
            aria-expanded={!collapsed}
            title={ariaLabel}
          >
            <ChevronDown
              size={18}
              color={COLOR.ICON.MUTED}
              style={{
                transition: "transform 120ms ease",
                transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                opacity: collapseDisabled ? 0.5 : 1,
              }}
            />
          </button>
        </div>
      </div>

      <div style={styles.collapseOuter(collapsed)}>
        <div style={styles.collapseInner}>
          {children}
        </div>
      </div>

    </div>
  );
}

const styles = {
  sectionTitle: {
    paddingTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 10,
  },
  sectionRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  subtotalInline: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  toggleBtn: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    cursor: "pointer",
    padding: 8,
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  collapseOuter: (collapsed: boolean): React.CSSProperties => ({
    display: "grid",
    gridTemplateRows: collapsed ? "0fr" : "1fr",
    transition: "grid-template-rows 220ms ease, opacity 220ms ease",
    opacity: collapsed ? 0 : 1,
    pointerEvents: collapsed ? "none" : "auto",
  }),
  collapseInner: {
    overflow: "hidden",
    minHeight: 0,
  } as const,
  subtotalLabel: {
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  subtotalValue: {
    fontWeight: 700,
    fontSize: 16,
    color: COLOR.ACCENT.PRIMARY,
  },
} as const;

